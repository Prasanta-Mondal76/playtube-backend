import { Router } from "express";
import {
initiateRegistration,
verifyOtpAndRegister,
loginUser,
logoutUser,
renewAccessRefreshToken,
changeCurrentPassword,
getCurrentUser,
updateData,
updateAvatar,
updateCoverImage,
getOtherChannelDetails,
getWatchHistory,
forgotUserPassword,
resetPassword,
requestDeleteAccount,
cancelDeleteAccount,
confirmDeleteAccount
} from "../controller/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Register User | 2 Step Process
router.route("/initiate-registration").post(
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
  initiateRegistration
)

router.route("/verify-registration").post(verifyOtpAndRegister)

router.route("/login").post(loginUser);


// Secure Routes
router.route("/logout").post(verifyJWT, logoutUser)

// Endpoint for generating new Access and RefreshToken
router.route("/refresh-token").post(renewAccessRefreshToken)

// Change password
router.route("/change-password").post(verifyJWT, changeCurrentPassword)

router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-user").patch(verifyJWT, updateData)

router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateAvatar)
router.route("/update-coverImage").patch(verifyJWT, upload.single("coverImage"), updateCoverImage)

// Channel details route
router.route("/channel/:username").get(verifyJWT, getOtherChannelDetails)
// Watch History route
router.route("/history").get(verifyJWT, getWatchHistory)

router.route("/forgot-password").post(forgotUserPassword)
router.route("/reset-password/:token").post(resetPassword)

// Delete Account Routes
router.route("/delete-account/request").post(verifyJWT, requestDeleteAccount);
router.route("/delete-account/confirm/:token").delete(confirmDeleteAccount);
router.route("/delete-account/cancel/:token").delete(cancelDeleteAccount);   

export default router;