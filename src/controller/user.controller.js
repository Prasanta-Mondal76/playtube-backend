import {
  ApiError,
  ApiResponse,
  asyncHandler,
  deleteFromCloudinary,
  uploadOnCloudinary,
  sendMail,
  deleteLocalTempFiles,
  registrationSuccessMail,
  resetLinkMail,
  accountDeletionConfirmMail,
  accountDeletionSuccessMail,
  storeRegistrationData,
  verifyOtp,
  otpMail,

} from "../utils/index.js"
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "node:crypto";
import redisClient from "../db/redis.js"
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Subscription } from "../models/subscription.model.js"

const checkNameAndEmailFormat = (fullName, email) => {
  const trimFullName = fullName?.trim()
  const trimEmail = email?.trim()
  if (trimFullName) {
    if (trimFullName.split(" ").filter(Boolean).length < 2) {
      throw new ApiError(400, "Please enter full name (first and last name)")
    }
  }
  if (trimEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimEmail)) {
      throw new ApiError(400, "Invalid email format")
    }
    if (trimEmail !== trimEmail.toLowerCase()) throw new ApiError(400, "Email must be in lowercase")

  }
  return { trimFullName, trimEmail };
}

const storngPasswordValidation = (pass, len = 6) => {
  // const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?&])\S{8,}$/;
  const regex = new RegExp(`^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{${len},}$`)
  if (!regex.test(pass)) throw new ApiError(400, `Password must be >=${len} and contains uppercase. lowercase, numbers and special characters.`)
  return;
}

// Register User | 2 step process.

// Get user details from frontend
// Validation of details | All details are correct or not, email format, any required fild is empty or not
// Check is user already exsts ? by there unique identity like: username, email.
// Check for images , Check for avatar (It's a required field)
// Store data in Redis, Send OTP to user
// In next completeRegistration , verify user.
// If verified user then upload files on cloudinary. 
// Create user Object - create entry in db
// remove password and refresh token field from response
// check for user creation 
// return response  
const initiateRegistration = asyncHandler(async (req, res) => {
  try {
    // Get User Details
    const { fullName, username, password, email } = req.body

    // Set a Colldown period using redis key.
    const cooldownKey = `reg:cooldown:${email}`
    const cooldownExists = await redisClient.exists(cooldownKey)
    if (cooldownExists) throw new ApiError(429, "Please wait for 5 minute before requesting again");
    await redisClient.set(cooldownKey, "1", { EX: 299 })
    // console.log("Email: ",email);
    // console.log("Password: ",password);
    // console.log("Avatar: ",avatar);
    // console.log("CoverImage: ",coverImage);

    //Validation of details
    if ([fullName, username, password, email].some((item) => !item?.trim())) {
      throw new ApiError(400, "Required fields can't be empty.")
    }

    // Checking for images , Checking for avatar
    // console.log("-------------------------------Multer req.body --------------------------------- \n ",req.body);
    // console.log("-------------------------------Multer req.files --------------------------------- \n ",req.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    //checking required image file avatar
    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar image is required.")
    }

    // fullName and email validation
    const { trimFullName, trimEmail } = checkNameAndEmailFormat(fullName, email);

    // Strong Password Validation. Second perameter is the minimum length of the password
    storngPasswordValidation(password, 6);

    //Checking User already exists or not
    const isExists = await User.findOne({
      $or: [
        { username },
        { email }
      ]
    })

    // If email or username exists remove the files from local storge.
    if (isExists) {
      throw new ApiError(409, "User already exists with this email or username.");
    }

    const otp = await storeRegistrationData(trimEmail, {
      username: username.trim().toLowerCase(),
      email: trimEmail,
      fullName: trimFullName,
      avatarLocalPath,
      coverImageLocalPath,
      password,
    });

    // OTP mail bhejo
    await sendMail({
      to: trimEmail,
      subject: "Verify Your Email — PlayTube",
      html: otpMail(trimFullName, otp),
    });

    return res.status(200).json(new ApiResponse(
      200,
      { email: trimEmail },
      "OTP sent to your email. Valid for 5 minutes."
    ))
  } catch (error) {
    deleteLocalTempFiles(req)
    throw new ApiError(error.statusCode || 500, error.message || "Something went wrong.")
  }
})

const verifyOtpAndRegister = asyncHandler(async (req, res) => {
  let avatarImage;
  let coverImage;
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new ApiError(400, "Email and OTP are required.");

    // Fetch data from redis
    const registrationData = await verifyOtp(email, otp);

    // If user verified then upload fiels on cloudinary
    avatarImage = await uploadOnCloudinary(registrationData.avatarLocalPath);
    if (!avatarImage) throw new ApiError(400, "Avatar upload failed.");
    coverImage = await uploadOnCloudinary(registrationData.coverImageLocalPath);

    // Create user
    const user = await User.create({
      username: registrationData.username,
      email: registrationData.email,
      fullName: registrationData.fullName,
      avatar: avatarImage.url,
      coverImage: coverImage?.url || "",
      password: registrationData.password,
    });

    // Create response data except password and refresh token
    const createdUser = user.toObject();
    delete createdUser.password;
    delete createdUser.refreshToken;

    // Send Success email 
    await sendMail({
      to: createdUser.email,
      subject: "Registration Successful",
      html: registrationSuccessMail(
        createdUser.fullName,
        createdUser.username,
        createdUser.email
      ),
    });

    return res.status(201).json(
      new ApiResponse(201, createdUser, "User Registration Successful.")
    );

  } catch (error) {
    if (avatarImage?.url) await deleteFromCloudinary(avatarImage.url);
    if (coverImage?.url) await deleteFromCloudinary(coverImage.url);
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Something went wrong"
    );
  }
})


// Access and refresh token generation function
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)
    // If password is correct then generate accessToken and refreshToken
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Save refreshToken in DB
    user.refreshToken = refreshToken;
    await user.save();

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Access and refresh token generation faild.");
  }
}

// Secure Options, helps while we save a cookie
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict"
}

// Login User
const loginUser = asyncHandler(async (req, res) => {
  // Get data from frontend or req.body
  // Validatiion of data | email or username and passowrd
  // Check user exist or not by email or username 
  // If user exist then compare password is correct or not | using bcryptjs
  // If password is correct then generate accessToken and refreshToken
  // Save refreshToken in DB
  // Return response (accessToken and user details except user password and refreshToken details)
  // console.log("Login API hit: ", req.body)

  // Get data from frontend or req.body
  const { username, password, email } = req.body

  // Validatiion of data | email or username and passowrd
  // Check username or email field is empty
  if (!username && !email) throw new ApiError(400, "Username or Email is required.")

  // Check user exist or not by email or username
  // Find user by email or username
  const user = await User.findOne({
    $or: [{ email }, { username }]
  })
  if (!user) throw new ApiError(404, "User does not exixt. Please register first.")

  // If user exist then compare password is correct or not | using bcryptjs
  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials. Please try again.")


  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  // Creating a new object to send in response After removing password and refreshToken from user details

  // // Method 1: Using db query.
  // const loggedInUser = User.findById(user._id).select("-password -refreshToken");

  // Method 2: By copying user object.
  const userData = user.toObject(); // Shallow Copy
  delete userData.password;
  delete userData.refreshToken;
  delete userData.forgotPasswordToken;
  delete userData.forgotPasswordExpiry;

  // Return response (accessToken and user details except user password and refreshToken details)
  return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            userData,
            accessToken
          }
        },
        "User logged in successfully."
      )
    )
})


// Logout User
const logoutUser = asyncHandler(async (req, res) => {
  // To logout a user we need reference of the user and that's why we create a custom middleware name: auth.middleert.Js

  // Find user and remove refreshToken field from model. So that user have no longer access of login.
  const logOutDetails = await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1
      }
    }
  );


  // Remove cookies and rend response.
  res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, { name: logOutDetails.email }, "Logged Out."))

})


// Access token renew process 
const renewAccessRefreshToken = asyncHandler(async (req, res) => {
  // console.log("Cookies => ",req.cookies);
  // console.log("Body => ",req.body);

  // RefreshToken Save in cookies.[req.cookies.refreshToken] || If the request comming form web app then it store in req.body. 
  const encodedRfToken = req.cookies.refreshToken || req.header("Authorization")?.replace("Bearer ", "");

  if (!encodedRfToken) throw new ApiError(401, "Unauthorized request.")

  try {
    // Decode encoded refreshToken.
    const userId = jwt.verify(encodedRfToken, process.env.REFRESH_TOKEN_SECRET); // Ye "_id" return karega object form me. Because: While generating refreshToken we use "_id: this._id" payload.

    const user = await User.findById(userId._id);

    if (!user) throw new ApiError(401, "Invalid Refresh Token.")

    if (encodedRfToken !== user.refreshToken) throw new ApiError(401, "Refresh token is expired or used.")

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(
        200,
        {
          accessToken,
        },
        "Access and RefreshToken Renewed Successfully."
      ))

  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token.");
  }

});


// Change Password
const changeCurrentPassword = asyncHandler(async (req, res) => {

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) throw new ApiError(400, "Password fields required");

  if (oldPassword === newPassword) throw new ApiError(400, "Unchanged Password.")

  // Strong passworc validation
  storngPasswordValidation(newPassword);

  const currentUser = await User.findById(req.user._id);

  const isPassCorrect = await currentUser.isPasswordCorrect(oldPassword);

  if (!isPassCorrect) throw new ApiError(400, "Incorrect Password.")

  currentUser.password = newPassword;
  await currentUser.save({ validateBeforeSave: false });

  res.status(200)
    .json(new ApiResponse(
      200,
      {},
      "Password Updated Successfully."
    ))
})


// Get current user details function 
const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200)
    .json(new ApiResponse(
      200,
      req.user,
      "Current user fatched Successfully."
    ))
})


// Update fullName & email info
const updateData = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!(fullName || email)) throw new ApiError(400, "Please provide at least one field to update");

  const user = await User.findById(req.user._id).select("-refreshToken -password")

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const { trimFullName, trimEmail } = await checkNameAndEmailFormat(fullName, email);

  user.fullName = trimFullName ? trimFullName : user.fullName
  user.email = trimEmail ? trimEmail : user.email
  await user.save({ validateBeforeSave: false })


  return res.status(200)
    .json(new ApiResponse(
      200,
      user,
      "Details Update Successfully."
    ))
})


// File update utility
const updateFiles = async (file, id) => {

  // console.log("File ==> ", file);

  const localFilePath = file?.path;
  const updateFieldName = file?.fieldname;

  if (!localFilePath) throw new ApiError(400, "File is missing.")

  const uploadedFile = await uploadOnCloudinary(localFilePath)

  if (!uploadedFile.url) throw new ApiError(400, "Error in uploading process.")

  const user = await User.findById(id).select("-password -refreshToken")

  if (!user) throw new ApiError(400, "User not found in update file Process.")

  const oldUrl = user[updateFieldName];

  user[updateFieldName] = uploadedFile.url
  await user.save({ validateBeforeSave: false })

  await deleteFromCloudinary(oldUrl);
  return user;
}

// Update Avatar
const updateAvatar = asyncHandler(async (req, res) => {
  try {
    const resObj = await updateFiles(req.file, req.user._id);

    res.status(200).json(new ApiResponse(200, resObj, "Avatar Updated Successfully."))
  } catch (error) {
    deleteLocalTempFiles(req);
    throw new ApiError(error.statusCode, error.message);
  }
})

// Update Covered Image
const updateCoverImage = asyncHandler(async (req, res) => {
  try {
    const resObj = await updateFiles(req.file, req.user._id);

    res.status(200).json(new ApiResponse(200, resObj, "Covered Image Updated Successfully."))
  } catch (error) {
    deleteLocalTempFiles(req);
    throw new ApiError(error.statusCode, error.message);
  }
})

// User channel details 
const getOtherChannelDetails = asyncHandler(async (req, res) => {
  console.log("User Channel Req: => ", req.params)
  const { username } = req.params;

  if (!username) throw new ApiError(404, "Username not found.")

  const user = await User.findOne({ username }).select("-password -refreshToken -watchHistory").lean()

  if (!user) throw new ApiError(404, "User doesn't exists.")

  return res.status(200)
    .json(new ApiResponse(
      200,
      user,
      "User Details Fatched Successfully."
    ))
})


// Watch history function. To find watch hintory uer must be login. And if user login we get the user details in req.user[auth.middleware]
const getWatchHistory = asyncHandler(async (req, res) => {

  const user = await User.aggregate([
    {
      $match: {
        // Convert req.user._id to ObjectId because MongoDB stores _id as ObjectId, not as a string. But when we write "req.user._id" it gives a string, Not the ObjetId().
        //For normal case we just send the req.user._id and mongooes internally convert in into ObjectId type. But in aggregation pipeline we need to send the exact format
        //So, If you simply write  _id : req.user._id; It missmatch the type.

        _id: new mongoose.Types.ObjectId(req.user._id) // This ensures proper matching inside the aggregation pipeline and avoids type mismatch issues. 
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        // Nested Lookup to find video owner details because this models(User, Video) are interconnected. 
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      },
    }
  ])

  return res.status(200)
    .json(new ApiResponse(
      200,
      user[0].watchHistory,
      "Watch History Fatched Successfully."
    ))
})


// PROCESS: Forgot password flow uses two methods: forgotUserPassword and resetPassword.
// forgotUserPassword: When user clicks on forgot password, frontend sends a POST request to (/forgot-password).
// It generates a secure reset token, stores hashed token related data in Redis, and sends a password reset link or OTP to the user's email.
//
// resetPassword: When user clicks the reset link, frontend sends another POST request to (/reset-password).
// Backend validates the token and resets the password.
//
// If OTP method is used, frontend first opens an OTP verification form.
// After successful OTP verification, user can reset the password.
const forgotUserPassword = asyncHandler(async (req, res) => {
  // Forgot Password using OTP. ||  Forgot Password using url. 
  // Use crypto.randomInt() for secure random number generation || crypto.randomBytes(32) for reset token generation
  // Store hash otp as a redis key. || Store reset token as a redis key
  // Send otp to user email || Send reset link to user email
  const { email } = req.body;

  const user = await User.findOne({ email }).select("_id email fullName").lean();
  if (user) {
    // Set a Colldown period using redis key.
    const cooldownKey = `cooldown:${email}`
    const cooldownExists = await redisClient.exists(cooldownKey)
    if (cooldownExists) throw new ApiError(429, "Please wait for 3 minute before requesting again");
    await redisClient.set(cooldownKey, "1", { EX: 180 })

    // URL Method
    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    // Hash token 
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Deleting existing token key
    const oldToken = await redisClient.get(`user-reset:${user._id}`);
    if (oldToken) {
      await redisClient.del(`reset:${oldToken}`);
    }

    // Token Store
    await redisClient.set(
      `reset:${hashedToken}`,
      user._id.toString(),
      { EX: 600 }
    )

    // Creating key for delete old token key in case of multiple mail request
    await redisClient.set(
      `user-reset:${user._id}`,
      hashedToken,
      { EX: 600 }
    );

    // ****** NEED TO BE CHANGE ******
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    // Send Mail
    try {
      await sendMail({ to: email, subject: "Reset Password", html: resetLinkMail(user.fullName, resetUrl) })
    } catch (error) {
      await Promise.all([
        redisClient.del(`reset:${hashedToken}`),
        redisClient.del(`user-reset:${user._id}`),
        redisClient.del(cooldownKey)
      ])
      throw new ApiError(500, "Failed to send reset email")
    }
  }

  return res.status(200)
    .json(new ApiResponse(
      200,
      {},
      "If an account with this email exists, a reset link has been sent."
    )
    )
})
// verify OTP validity. and make it Invalidate OTP after successful use. || No need to verify, directly reset password. 
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  //Password Validation
  storngPasswordValidation(newPassword);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const userId = await redisClient.getDel(`reset:${hashedToken}`)

  if (!userId) throw new ApiError(400, "Token invalid or expired");

  const user = await User.findById(userId).select("+password +refreshToken")

  if (!user) throw new ApiError(404, "User not found");

  user.password = newPassword;
  // Logout all existing sessions/devices after password reset
  user.refreshToken = undefined;
  await user.save();

  // If password reset successfully then delete user-rese key also. 
  await redisClient.del(`user-reset:${user._id}`);

  return res.status(200).json(new ApiResponse(200, {}, "Password Reset Successfully."))
})


// Delete User Account : This Process include 3 steps. Request - Confirm/Cancel
// Request for Delete
const requestDeleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const email = req.user.email;

  if (!userId || !email) throw new ApiError(401, "Access Decline.")

  // Cooldown Periods of 10 min
  const cooldownKey = `delete-cooldown:${userId}`;
  const cooldownExists = await redisClient.exists(cooldownKey);
  if (cooldownExists) throw new ApiError(429, "Please wait 10 minutes before requesting again.");
  await redisClient.set(cooldownKey, "1", { EX: 600 }); // 10 min cooldown

  // Generate account deletion token
  const deleteToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(deleteToken).digest("hex");

  // Store token in Redis — 1 hour valid
  await redisClient.set(
    `delete-account:${hashedToken}`,
    userId.toString(),
    { EX: 3600 }
  );

  const confirmUrl = `${process.env.FRONTEND_URL}/delete-account/confirm/${deleteToken}`;
  const cancelUrl = `${process.env.FRONTEND_URL}/delete-account/cancel/${deleteToken}`;

  await sendMail({
    to: email,
    subject: "Confirm Account Deletion — PlayTube",
    html: accountDeletionConfirmMail(req.user.fullName, confirmUrl, cancelUrl)
  });

  return res.status(200).json(new ApiResponse(
    200,
    {},
    "A confirmation email has been sent. Please check your inbox."
  ));
});

// Cancel Request 
const cancelDeleteAccount = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Delete token from Redis.
  const deleted = await redisClient.getDel(`delete-account:${hashedToken}`);

  if (!deleted) throw new ApiError(400, "Link is invalid or already expired.");

  return res.status(200).json(new ApiResponse(
    200,
    {},
    "Account deletion cancelled. Your account is safe."
  ));
});

// Permanent delete
const confirmDeleteAccount = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Validate Token 
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const userId = await redisClient.getDel(`delete-account:${hashedToken}`);

  if (!userId) throw new ApiError(400, "Confirmation link is invalid or expired.");

  // Clean Cooldown Key
  await redisClient.del(`delete-cooldown:${userId}`);

  // ---------------------------------------------------
  // STEP 1: Pre-transaction data fetch
  // Transaction ke andar find karna expensive hota hai.
  // Isliye pehle saara data fetch karo jo baad mein Cloudinary delete aur cascading ke liye chahiye.
  // ---------------------------------------------------

  // Fetch all videos of user
  const videos = await Video.find(
    { owner: userId },
    "_id videoFile thumbnail"
  ).lean();

  const videoIds = videos.map((v) => v._id);

  // Fetch all comments of all Videos (We need commentIds for Like deletion)
  const comments = await Comment.find(
    { video: { $in: videoIds } },
    "_id"
  ).lean();

  const commentIds = comments.map((c) => c._id);

  // ---------------------------------------------------
  // STEP 2: MongoDB Transaction — DB operations
  // ---------------------------------------------------
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1. Delete User
    const deletedUser = await User.findOneAndDelete(
      { _id: userId },
      { session }
    );
    if (!deletedUser) throw new ApiError(404, "User not found.");

    await Promise.all([
      // 2. Delete all videos of User
      Video.deleteMany({ owner: userId }, { session }),

      // 3. Delete All comments of All Videos
      Comment.deleteMany({ video: { $in: videoIds } }, { session }),

      // 4. Delete all likes of all deleted videos
      Like.deleteMany({ video: { $in: videoIds } }, { session }),

      // 5. Delete all likes of all deleted comments
      Like.deleteMany({ comment: { $in: commentIds } }, { session }),

      // 6. Delete all playlists created by user
      Playlist.deleteMany({ owner: userId }, { session }),

      // 7. Remove video IDs from others users playlist, It prevent orphan references .
      Playlist.updateMany(
        { videos: { $in: videoIds } },
        { $pull: { videos: { $in: videoIds } } },
        { session }
      ),

      // 8. Delete user from all subscription.
      Subscription.deleteMany({ subscriber: userId }, { session }),

      // 9. Delete all subscribers of user.
      Subscription.deleteMany({ channel: userId }, { session }),
    ]);

    await session.commitTransaction();

    // ---------------------------------------------------
    // STEP 3: Cloudinary Cleanup — Transaction ke BAAD
    // Agar transaction fail ho toh Cloudinary delete nahi
    // hoga. Agar Cloudinary fail ho toh DB already clean hai.
    // Ye tumhara existing pattern hai — isko follow kiya.
    // ---------------------------------------------------
    const cloudinaryDeletionPromises = [
      ...videos.flatMap(video => [
        video.videoFile
          ? deleteFromCloudinary(video.videoFile)
          : null,

        video.thumbnail
          ? deleteFromCloudinary(video.thumbnail)
          : null,
      ]),

      deletedUser.avatar
        ? deleteFromCloudinary(deletedUser.avatar)
        : null,

      deletedUser.coverImage
        ? deleteFromCloudinary(deletedUser.coverImage)
        : null,
    ].filter(Boolean); // Remove null values 

    // Delete All assets parallelly. 
    // Promise.allSettled : If a deletion faild , rest of assets deletion process will continue.
    // Promise.all : If a deletion faild , rest of assets deletion process will Stop.
    await Promise.allSettled(cloudinaryDeletionPromises);

    // Send a mail of deletion 
    await sendMail({
      to: deletedUser.email,
      subject: "Account Deleted",
      html: accountDeletionSuccessMail(deletedUser.fullName)
    })

    // Clear Cookies — user logout 
    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "Account deleted successfully."));

  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to delete account."
    );
  } finally {
    await session.endSession();
  }
});

export {
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

  //Delete Account
  requestDeleteAccount,
  cancelDeleteAccount,
  confirmDeleteAccount
};