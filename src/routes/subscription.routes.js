import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import { 
  toggleSubscription,
  getSubscriptionStats,
  getUserSubscribers,
  getUserSubscriptions
} from "../controller/subscription.controller.js"

const router = Router()

router.use(verifyJWT)

router.route("/channel/:channelId").post(toggleSubscription)
router.route("/channel/:channelId/stats").get(getSubscriptionStats)

// Expensive
router.route("/subscribers/:channelId").get(getUserSubscribers)
router.route("/subscriptions/:userId").get(getUserSubscriptions)

export default router;