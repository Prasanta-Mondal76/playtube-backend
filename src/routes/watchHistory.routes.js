import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { 
  updateWatchHistory, 
  getWatchHistory,
  clearWatchHistory,
  togglePauseHistory
} from "../controller/watchHistory.controller.js"


const router = Router()

router.route("/get-history").get(verifyJWT, getWatchHistory)
router.route("/update/:videoId").post(verifyJWT, updateWatchHistory)
router.route("/clear").delete(verifyJWT, clearWatchHistory);
router.route("/pause-toggle").patch(verifyJWT, togglePauseHistory);


export default router