import { isValidObjectId } from "mongoose";
import { ApiError, ApiResponse, asyncHandler } from "../utils/index.js";
import { User } from "../models/user.model.js";
import { Block } from "../models/block.model.js";
import { Conversation } from "../models/conversation.model.js";

// Block a user
export const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID.");
  }

  if (req.user._id.equals(userId)) {
    throw new ApiError(400, "You cannot block yourself.");
  }

  const userToBlock = await User.findById(userId);
  if (!userToBlock) {
    throw new ApiError(404, "User not found.");
  }

  const alreadyBlocked = await Block.exists({
    blocker: req.user._id,
    blocked: userId,
  });

  if (alreadyBlocked) {
    throw new ApiError(409, "User is already blocked.");
  }

  await Block.create({
    blocker: req.user._id,
    blocked: userId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User blocked successfully."));
});

// Unblock a user
export const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID.");
  }

  const block = await Block.findOneAndDelete({
    blocker: req.user._id,
    blocked: userId,
  });

  if (!block) {
    throw new ApiError(404, "Block not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User unblocked successfully."));
});

// Get all users I have blocked
export const getBlockedUsers = asyncHandler(async (req, res) => {
  const blocks = await Block.find({ blocker: req.user._id })
    .sort({ createdAt: -1 })
    .populate("blocked", "username fullName avatar");

  return res.status(200).json(
    new ApiResponse(
      200,
      { blocks, count: blocks.length },
      "Blocked users fetched successfully."
    )
  );
});

// Check if a specific user is blocked (by either side)
export const getBlockStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID.");
  }

  const iBlockedThem = await Block.exists({
    blocker: req.user._id,
    blocked: userId,
  });

  const theyBlockedMe = await Block.exists({
    blocker: userId,
    blocked: req.user._id,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        iBlockedThem: !!iBlockedThem,
        theyBlockedMe: !!theyBlockedMe,
        isBlocked: !!(iBlockedThem || theyBlockedMe),
      },
      "Block status fetched successfully."
    )
  );
});