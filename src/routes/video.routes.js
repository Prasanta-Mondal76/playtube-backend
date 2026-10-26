import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js"

import 
{ 
  publishAVideo,
  getAllVideos,
  updateVideoDetails,
  togglePublishStatus,
  deleteVideo,
  getVideoById,
  recordVideoView,
  getChannelVideos,
  searchVideos,
} from "../controller/video.controller.js"

const router = Router()

// 1-stage flow: files go straight from the browser to Cloudinary,
// so this route now receives only JSON (URLs + details) — no multer.
router.route("/publish-video")
.post(verifyJWT, publishAVideo)

// For Owner
router.route("/all-videos").get(getAllVideos)

// For Public Channels 
router.route("/user/all-videos/:channelId").get(verifyJWT, getChannelVideos)

router.route("/get-video/:videoId").get( getVideoById )
router.route("/update-video-details/:videoId").patch(verifyJWT, updateVideoDetails)
router.route("/delete-video/:videoId").delete(verifyJWT, deleteVideo)
router.route("/toggle-published/:videoId").patch(verifyJWT, togglePublishStatus);
router.route("/views/:videoId").post(recordVideoView);

router.route("/search").get(searchVideos)
export default router;