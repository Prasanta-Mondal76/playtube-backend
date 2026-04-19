import { Router } from "express";
import 
{ registerUser, 
  loginUser, 
  logoutUser, 
  renewAccessRefreshToken, 
  changeCurrentPassword, 
  getCurrentUser, 
  updateData,
  updateAvatar,
  updateCoverImage
} from "../controller/user.controler.js";

import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1
    },
    {
      name: "coverImage",
      maxCount: 1
    }
  ]),
  registerUser
)

router.route("/login").post(loginUser);


// Secure Routes
router.route("/logout").post(verifyJWT, logoutUser)

// Endpoint for generating new Access and RefreshToken
router.route("/refresh-token").post(renewAccessRefreshToken)

// Change password
router.route("/change-password").post(verifyJWT, changeCurrentPassword)

router.route("/current-user").post(verifyJWT, getCurrentUser)
router.route("/update-user").post(verifyJWT, updateData)

router.route("/update-avatar").post(verifyJWT, upload.single("avatar"), updateAvatar)
router.route("/update-coverImage").post(verifyJWT, upload.single("coverImage"), updateCoverImage)

export default router;