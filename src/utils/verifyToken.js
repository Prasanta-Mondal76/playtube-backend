
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const verifyToken = async (token) => {
  try {
    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id)
      .select("-password -refreshToken")
      .lean();

    return user;

  } catch (error) {
    return null;
  }
};