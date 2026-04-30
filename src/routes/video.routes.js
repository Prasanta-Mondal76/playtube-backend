import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js"

import 
{ 
  publishAVideo,
  getAllVideos,
  updateVideoDetails
} from "../controller/video.controler.js"
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
router.route("/update-video-details/:videoId").patch(verifyJWT, updateVideoDetails)


export default router;