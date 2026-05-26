import crypto from "crypto";
import redisClient from "../db/redis.js";
import { ApiError } from "./apiError.js";

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 3;
const REDIS_PREFIX = "otp_reg:";

export const generateOtp = () =>
  crypto.randomInt(0, 999999).toString().padStart(4, "0").padEnd(6, "9"); // Cryptographically secure

export const storeRegistrationData = async (email, payload) => {
  const otp = generateOtp();
  const key = `${REDIS_PREFIX}${email}`;

  await redisClient.setEx(
    key,
    OTP_EXPIRY_SECONDS,
    JSON.stringify({ ...payload, otp, attempts: 0 })
  );

  return otp;
};

export const verifyOtp = async (email, inputOtp) => {
  const key = `${REDIS_PREFIX}${email}`;
  const raw = await redisClient.get(key);

  if (!raw) {
    throw new ApiError (410, "OTP expired or not found. Please register again.")
  }

  const data = JSON.parse(raw);

  // Increment attempt count
  data.attempts += 1;

  if (data.attempts > MAX_ATTEMPTS) {
    await redisClient.del(key); // Invalidate after too many attempts
    throw new ApiError( 429, "Too many incorrect attempts. Please register again.")
  }

  if (data.otp !== inputOtp) {
    // Save updated attempts back
    await redisClient.setEx(key, await redisClient.ttl(key), JSON.stringify(data));
    const remaining = MAX_ATTEMPTS - data.attempts;
    throw new ApiError(400, `Incorrect OTP. ${remaining} attempt(s) remaining.`)
  }

  // OTP is valid — delete it and return stored payload
  await redisClient.del(key);
  const { otp, attempts, ...registrationPayload } = data;
  return registrationPayload;
};