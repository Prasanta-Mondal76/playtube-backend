import { Router } from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import {
  addComment,
  updateComment,
  deleteComment,
  getVideoComments
} from "../controller/comment.controller.js"

const router = Router()

router.route("/video-comments/:videoId").get(getVideoComments) // public

router.use(verifyJWT)

router.route("/add/:videoId").post(addComment)
router.route("/update/:commentId").patch(updateComment)
router.route("/delete/:commentId").delete(deleteComment)


export default router