import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import { 
  toggleSubscription,
  getChannelSubscriberCount,
  getSubscribedChannelCount,
} from "../controller/subscription.controller.js"

const router = Router()

router.use(verifyJWT)

router.route("/channel/:channelId").post(toggleSubscription)
router.route("/subscribers/:channelId").get(getChannelSubscriberCount)
router.route("/sybscribed/:subscriberId").get(getSubscribedChannelCount)

export default router;