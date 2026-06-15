import Razorpay from "razorpay";
import crypto from "crypto";
import { asyncHandler, ApiError, ApiResponse } from "../utils/index.js";
import { Payment } from "../models/payment.model.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Available plans
const PLANS = {
  plan_1hr: { amount: 1000, label: "1 hour", durationMs: 1 * 60 * 60 * 1000 },
  plan_5hr: { amount: 2000, label: "5 hours", durationMs: 5 * 60 * 60 * 1000 },
  plan_2day: { amount: 5000, label: "2 days", durationMs: 2 * 24 * 60 * 60 * 1000 },
  plan_15day: { amount: 10000, label: "15 days", durationMs: 15 * 24 * 60 * 60 * 1000 },
};

// POST /api/v1/payments/create-order
const createOrder = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, "Unauthorized.");

  const { planId } = req.body;
  const plan = PLANS[planId];
  if (!plan) throw new ApiError(400, "Invalid plan selected.");

  const options = {
    amount: plan.amount, // in paise
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
  };

  let order;
  try {
    order = await razorpay.orders.create(options);
  } catch (razorpayError) {
    console.log("RAZORPAY ERROR:", JSON.stringify(razorpayError, null, 2));
    throw new ApiError(400, razorpayError?.error?.description || "Razorpay failed");
  }

  // Save pending payment record
  await Payment.create({
    userId: req.user._id,
    razorpayOrderId: order.id,
    amount: plan.amount,
    planLabel: plan.label,
    durationMs: plan.durationMs,
    status: "created",
  });

  return res.status(201).json(
    new ApiResponse(201, {
      orderId: order.id,
      amount: plan.amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      planLabel: plan.label,
    }, "Order created.")
  );
});

// POST /api/v1/payments/verify
const verifyPayment = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, "Unauthorized.");

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing payment details.");
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "Payment verification failed. Invalid signature.");
  }

  // Find the pending payment record
  const payment = await Payment.findOne({
    razorpayOrderId: razorpay_order_id,
    userId: req.user._id,
    status: "created",
  });

  if (!payment) throw new ApiError(404, "Payment record not found.");

  // Activate the payment
  const now = new Date();
  payment.razorpayPaymentId = razorpay_payment_id;
  payment.status = "paid";
  payment.expiresAt = new Date(now.getTime() + payment.durationMs);
  await payment.save();

  return res.status(200).json(
    new ApiResponse(200, {
      active: true,
      expiresAt: payment.expiresAt,
      planLabel: payment.planLabel,
    }, "Payment verified. Access granted.")
  );
});

// GET /api/v1/payments/status
const getPaymentStatus = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, "Unauthorized.");

  const now = new Date();

  // Find the latest active paid record that hasn't expired
  const activePayment = await Payment.findOne({
    userId: req.user._id,
    status: "paid",
    expiresAt: { $gt: now },
  }).sort({ expiresAt: -1 });

  if (!activePayment) {
    return res.status(200).json(
      new ApiResponse(200, { active: false }, "No active payment.")
    );
  }

  return res.status(200).json(
    new ApiResponse(200, {
      active: true,
      expiresAt: activePayment.expiresAt,
      planLabel: activePayment.planLabel,
    }, "Active payment found.")
  );
});

export { createOrder, verifyPayment, getPaymentStatus };