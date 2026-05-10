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
  getVideoViewCount
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


router.route("/all-videos").get(getAllVideos)
router.route("/get-video/:videoId").get(verifyJWT, getVideoById)
router.route("/update-video-details/:videoId").patch(verifyJWT, updateVideoDetails)
router.route("/delete-video/:videoId").delete(verifyJWT, deleteVideo)
router.route("/toggle-published/:videoId").patch(verifyJWT, recordVideoView);
router.route("/views/:videoId").post(recordVideoView);
router.route("/total-views/:videoId").get(getVideoViewCount)


export default router;