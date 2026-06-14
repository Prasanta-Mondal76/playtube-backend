import mongoose, { isValidObjectId } from "mongoose";

import {
  ApiError,
  ApiResponse,
  asyncHandler,
} from "../utils/index.js";

import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ChatRequest } from "../models/chatRequest.model.js";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { io, userSocketMap } from "../db/socket.js"
import { Block } from "../models/block.model.js";

/* ==================================================
   REQUEST CONTROLLERS
================================================== */


export const sendChatRequest = asyncHandler(async (req, res) => {
  const { receiverId, reason } = req.body;

  if (!receiverId) {
    throw new ApiError(400, "Receiver ID is required.");
  }

  if (!isValidObjectId(receiverId)) {
    throw new ApiError(400, "Invalid receiver ID.");
  }

  if (!reason?.trim()) {
    throw new ApiError(400, "Reason is required.");
  }

  if (req.user._id.equals(receiverId)) {
    throw new ApiError(
      400,
      "You cannot send a chat request to yourself."
    );
  }

  const receiver = await User.findById(receiverId);

  if (!receiver) {
    throw new ApiError(404, "Receiver not found.");
  }

  const isSubscribed = await Subscription.exists({
    subscriber: req.user._id,
    channel: receiverId,
  });

  if (!isSubscribed) {
    throw new ApiError(
      403,
      "You must subscribe before sending a chat request."
    );
  }

  const isBlocked = await Block.exists({
    $or: [
      { blocker: req.user._id, blocked: receiverId },
      { blocker: receiverId, blocked: req.user._id },
    ],
  });

  if (isBlocked) {
    throw new ApiError(403, "You cannot send a request to this user.");
  }


  const existingConversation =
    await Conversation.findOne({
      $or: [
        {
          sender: req.user._id,
          receiver: receiverId,
        },
        {
          sender: receiverId,
          receiver: req.user._id,
        },
      ],
    });

  if (existingConversation) {
    throw new ApiError(
      409,
      "Conversation already exists."
    );
  }

  const existingPendingRequest =
    await ChatRequest.findOne({
      sender: req.user._id,
      receiver: receiverId,
      status: "pending",
    });

  if (existingPendingRequest) {
    throw new ApiError(
      409,
      "Chat request already pending."
    );
  }

  const chatRequest = await ChatRequest.create({
    sender: req.user._id,
    receiver: receiverId,
    reason: reason.trim(),
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      chatRequest,
      "Chat request sent successfully."
    )
  );
});




export const acceptChatRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await ChatRequest.findById(requestId);

  if (!request) {
    throw new ApiError(404, "Chat request not found.");
  }

  if (!request.receiver.equals(req.user._id)) {
    throw new ApiError(
      403,
      "You are not authorized to accept this request."
    );
  }

  if (request.status !== "pending") {
    throw new ApiError(
      400,
      `Request already ${request.status}.`
    );
  }

  const existingConversation =
    await Conversation.findOne({
      $or: [
        {
          sender: request.sender,
          receiver: request.receiver,
        },
        {
          sender: request.receiver,
          receiver: request.sender,
        },
      ],
    });

  if (existingConversation) {
    throw new ApiError(
      409,
      "Conversation already exists."
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    request.status = "accepted";

    await request.save({ session });

    const conversation =
      await Conversation.create(
        [
          {
            sender: request.sender,
            receiver: request.receiver,
            requestId: request._id,
          },
        ],
        { session }
      );

    await session.commitTransaction();

    return res.status(200).json(
      new ApiResponse(
        200,
        conversation[0],
        "Chat request accepted successfully."
      )
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
});




export const rejectChatRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await ChatRequest.findById(requestId);

  if (!request) {
    throw new ApiError(404, "Chat request not found.");
  }

  if (!request.receiver.equals(req.user._id)) {
    throw new ApiError(
      403,
      "You are not authorized to reject this request."
    );
  }

  if (request.status !== "pending") {
    throw new ApiError(
      400,
      `Request already ${request.status}.`
    );
  }

  request.status = "rejected";

  await request.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      request,
      "Chat request rejected successfully."
    )
  );
});



export const getReceivedChatRequests = asyncHandler(
  async (req, res) => {
    const requests = await ChatRequest.find({
      receiver: req.user._id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate(
        "sender",
        "username fullName avatar"
      );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          requests,
          count: requests.length,
        },
        "Chat requests fetched successfully."
      )
    );
  }
);

/* ==================================================
   CONVERSATION CONTROLLERS
================================================== */
export const getMyConversations = asyncHandler(
  async (req, res) => {
    const conversations =
      await Conversation.find({
        $or: [
          { sender: req.user._id },
          { receiver: req.user._id },
        ],
      })
        .sort({ updatedAt: -1 })
        .populate(
          "sender",
          "username fullName avatar"
        )
        .populate(
          "receiver",
          "username fullName avatar"
        );

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiver: req.user._id,
          isSeen: false,
        });

        return {
          ...conv.toObject(),
          unreadCount,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversations: conversationsWithUnread,
          count: conversationsWithUnread.length,
        },
        "Conversations fetched successfully."
      )
    );
  }
);

/* ==================================================
   MESSAGE CONTROLLERS
================================================== */

export const getConversationMessages = asyncHandler(
  async (req, res) => {
    const { conversationId } = req.params;

    if (!isValidObjectId(conversationId)) {
      throw new ApiError(
        400,
        "Invalid conversation ID."
      );
    }

    const conversation =
      await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(
        404,
        "Conversation not found."
      );
    }

    const isParticipant =
      conversation.sender.equals(req.user._id) ||
      conversation.receiver.equals(req.user._id);

    if (!isParticipant) {
      throw new ApiError(
        403,
        "You are not authorized to view these messages."
      );
    }

    const messages = await Message.find({
      conversationId,
    })
      .sort({ createdAt: 1 })
      .populate(
        "sender",
        "username fullName avatar"
      )
      .populate(
        "receiver",
        "username fullName avatar"
      );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          messages,
          count: messages.length,
        },
        "Messages fetched successfully."
      )
    );
  }
);




export const sendMessage = asyncHandler(
  async (req, res) => {
    const { conversationId } = req.params;
    const { text } = req.body;

    const trimmedText = text?.trim();

    if (!isValidObjectId(conversationId)) {
      throw new ApiError(400, "Invalid conversation ID.");
    }

    if (!trimmedText) {
      throw new ApiError(400, "Message text is required.");
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(404, "Conversation not found.");
    }

    const isParticipant =
      conversation.sender.equals(req.user._id) ||
      conversation.receiver.equals(req.user._id);

    if (!isParticipant) {
      throw new ApiError(
        403,
        "You are not authorized to send messages in this conversation."
      );
    }

    const receiverId =
      conversation.sender.equals(req.user._id)
        ? conversation.receiver
        : conversation.sender;

    const isBlocked = await Block.exists({
      $or: [
        { blocker: req.user._id, blocked: receiverId },
        { blocker: receiverId, blocked: req.user._id },
      ],
    });

    if (isBlocked) {
      throw new ApiError(403, "You cannot send messages to this user.");
    }

    const message = await Message.create({
      conversationId,
      sender: req.user._id,
      receiver: receiverId,
      text: trimmedText,
    });

    conversation.lastMessage = trimmedText;
    conversation.lastMessageSender = req.user._id;
    conversation.lastMessageAt = new Date();

    await conversation.save();

    const populatedMessage =
      await Message.findById(message._id)
        .populate("sender", "username fullName avatar")
        .populate("receiver", "username fullName avatar");

    const receiverSocketId = userSocketMap.get(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    }

    return res.status(201).json(
      new ApiResponse(201, populatedMessage, "Message sent successfully.")
    );
  }
);




export const getChatConnectionStatus = asyncHandler(
  async (req, res) => {
    const { receiverId } = req.params;

    if (!isValidObjectId(receiverId)) {
      throw new ApiError(
        400,
        "Invalid receiver ID."
      );
    }

    if (req.user._id.equals(receiverId)) {
      throw new ApiError(
        400,
        "Invalid receiver ID."
      );
    }

    const receiver = await User.findById(receiverId);

    if (!receiver) {
      throw new ApiError(
        404,
        "Receiver not found."
      );
    }

    const conversation =
      await Conversation.findOne({
        $or: [
          {
            sender: req.user._id,
            receiver: receiverId,
          },
          {
            sender: receiverId,
            receiver: req.user._id,
          },
        ],
      });

    if (conversation) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            status: "accepted",
            conversationId: conversation._id,
          },
          "Connection status fetched successfully."
        )
      );
    }

    const request = await ChatRequest.findOne({
      sender: req.user._id,
      receiver: receiverId,
    }).sort({ createdAt: -1 })
      .select("status");

    if (!request) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            status: "none",
          },
          "Connection status fetched successfully."
        )
      );
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          status: request.status,
          requestId: request._id,
        },
        "Connection status fetched successfully."
      )
    );
  }
);



export const markMessagesAsSeen = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID.");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found.");
  }

  const isParticipant =
    conversation.sender.equals(req.user._id) ||
    conversation.receiver.equals(req.user._id);

  if (!isParticipant) {
    throw new ApiError(403, "You are not authorized for this conversation.");
  }

  const result = await Message.updateMany(
    { conversationId, receiver: req.user._id, isSeen: false },
    { $set: { isSeen: true } }
  );

  if (result.modifiedCount > 0) {
    const otherUserId = conversation.sender.equals(req.user._id)
      ? conversation.receiver
      : conversation.sender;

    const otherSocketId = userSocketMap.get(otherUserId.toString());
    if (otherSocketId) {
      io.to(otherSocketId).emit("messagesSeen", {
        conversationId,
        seenBy: req.user._id,
      });
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Messages marked as seen.")
  );
});


/* ==================================================
   CLEAR CHAT CONTROLLER
================================================== */

export const clearChat = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID.");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ApiError(404, "Conversation not found.");
  }

  const isParticipant =
    conversation.sender.equals(req.user._id) ||
    conversation.receiver.equals(req.user._id);

  if (!isParticipant) {
    throw new ApiError(403, "You are not authorized to clear this chat.");
  }

  // Delete all messages in this conversation
  await Message.deleteMany({ conversationId });

  // Reset conversation's last message fields
  conversation.lastMessage = "";
  conversation.lastMessageSender = undefined;
  conversation.lastMessageAt = undefined;
  await conversation.save();

  // Notify the other participant in real time
  const otherUserId = conversation.sender.equals(req.user._id)
    ? conversation.receiver
    : conversation.sender;

  const otherSocketId = userSocketMap.get(otherUserId.toString());
  if (otherSocketId) {
    io.to(otherSocketId).emit("chatCleared", { conversationId });
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Chat cleared successfully.")
  );
});