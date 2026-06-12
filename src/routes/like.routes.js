import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import { 
  toggleVideoLike, 
  toggleCommentLike, 
  getLikedVideos,
  getLikeStatus,
} from "../controller/like.controller.js"

const router = Router()

router.use(verifyJWT)

router.route("/video/:videoId").post(toggleVideoLike)
router.route("/comment/:commentId").post(toggleCommentLike)
router.route("/videos").get(getLikedVideos)
router.route("/status").get(getLikeStatus) 
export default router;