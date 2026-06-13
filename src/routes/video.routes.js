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
import { upload } from "../middlewares/multer.middleware.js";

const router = Router()

router.route("/publish-video")
.post( 
  verifyJWT, 
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1
    },
    {
      name: "thumbnail",
      maxCount: 1
    },
  ]),
  publishAVideo
)

// For Owner
router.route("/all-videos").get(getAllVideos)

// For Public Channels 
router.route("/user/all-videos/:channelId").get(verifyJWT, getChannelVideos)

router.route("/get-video/:videoId").get( getVideoById )
router.route("/update-video-details/:videoId").patch(verifyJWT, upload.single("thumbnail"), updateVideoDetails)
router.route("/delete-video/:videoId").delete(verifyJWT, deleteVideo)
router.route("/toggle-published/:videoId").patch(verifyJWT, togglePublishStatus);
router.route("/views/:videoId").post(recordVideoView);

router.route("/search").get(searchVideos)
export default router;