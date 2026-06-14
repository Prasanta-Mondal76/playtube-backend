import { Router } from "express";

import { verifyJWT } from "../middlewares/auth.middleware.js";

import {
  sendChatRequest,
  acceptChatRequest,
  rejectChatRequest,
  getReceivedChatRequests,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  getChatConnectionStatus,
  markMessagesAsSeen,
  clearChat,
} from "../controller/message.controller.js";

const router = Router();

router.use(verifyJWT);

/* ==================================================
   REQUEST ROUTES
================================================== */

// Send chat request
router.route("/request").post(sendChatRequest);

// Get incoming pending requests
router.route("/requests").get(getReceivedChatRequests);

// Accept request
router.route("/request/:requestId/accept").patch(acceptChatRequest);

// Reject request
router.route("/request/:requestId/reject").patch(rejectChatRequest);

/* ==================================================
   CONVERSATION ROUTES
================================================== */

// Get all conversations
router.route("/conversations").get(getMyConversations);

/* ==================================================
   MESSAGE ROUTES
================================================== */

// Get messages of a conversation
router.route("/conversations/:conversationId/messages").get(getConversationMessages);

// Send message
router.route("/conversations/:conversationId/messages").post(sendMessage);

// Mark messages as seen
router.route("/conversations/:conversationId/seen").patch(markMessagesAsSeen);

// Clear chat
router.route("/conversations/:conversationId/clear").delete(clearChat);

/* ==================================================
   STATUS ROUTE
================================================== */

router.route("/status/:receiverId").get(getChatConnectionStatus);

export default router;