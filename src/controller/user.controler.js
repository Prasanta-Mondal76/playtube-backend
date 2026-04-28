import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import { sendMail } from "../utils/sendMail.js";
import { deleteLocalTempFiles } from "../utils/deleteTempFiles.js"


const checkNameAndEmailFormat =  (fullName, email) => {
  const trimFullName = fullName?.trim()
  const trimEmail = email?.trim()
  if (trimFullName) {
    if (!trimFullName.includes(" ")) {
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

const passwordValidation = (pass, len = 8) => {
  // const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?&])\S{8,}$/;
  const regex = new RegExp(`^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{${len},}$`)
  if (!regex.test(pass)) throw new ApiError(400, `Password must be >=${len} and contains uppercase. lowercase, numbers and special characters.`)
  return;
}

// Register User 
const registerUser = asyncHandler(async (req, res) => {
  try {
    // Get user details from frontend
    // Validation of details | All details are correct or not, email format, any required fild is empty or not
    // Check is user already exsts ? by there unique identity like: username, email.
    // Check for images , Check for avatar (It's a required field)
    // If images are present, upload them to cloudinary 
    // Create user Object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return response 
  
    // Get User Details
    const { fullName, username, password, email, avatar, coverImage } = req.body
    // console.log("Email: ",email);
    // console.log("Password: ",password);
    // console.log("Avatar: ",avatar);
  
    //Validation of details
    if ([fullName, username, password, email, avatar].some((item) => item === "")) {
      throw new ApiError(400, "Required fields can't be empty.")
    }
  
    // fullName and email validation
    const { trimFullName, trimEmail } =  checkNameAndEmailFormat(fullName, email);
  
    // Strong Password Validation. Second perameter is the minimum length of the password
    passwordValidation(password, 6);
  
    //Checking User already exists or not
    const isExists = await User.findOne({
      $or: [
        { username },
        { email }
      ]
    })
  
    
    // Checking for images , Checking for avatar
    // console.log("-------------------------------Multer req.body --------------------------------- \n ",req.body);
    // console.log("-------------------------------Multer req.files --------------------------------- \n ",req.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  
    // If email or username exists remove the files from local storge.
    if (isExists) {
      fs.unlinkSync(avatarLocalPath)
      fs.unlinkSync(coverImageLocalPath)
      throw new ApiError(409, "Username or Email already exists. Please login.");
    }
  
    //checking required image file avatar
    if (!avatarLocalPath) {
      deleteLocalTempFiles(req) //If avatar image is not present then remove all files from temp.
      throw new ApiError(400, "Avatar image is required.")
    }
  
  
    // Upload to cloudinary
    const avatarImage = await uploadOnCloudinary(avatarLocalPath);
    const coverImages = await uploadOnCloudinary(coverImageLocalPath);
    //Checking requird fild avatar
    if (!avatarImage) throw new ApiError(400, "Avatar file is empty.");
  
    // Create User Object
    const user = await User.create({
      username: username.trim().toLowerCase(),
      email: trimEmail,
      fullName: trimFullName,
      avatar: avatarImage.url,
      coverImage: coverImages?.url || "",
      password,
    })
  
    // Removed Password and RefreshToken field | User.findById(user._id) it find the user with the _id which db automatically add. ".select()" select all fields of user. "-password -refreshToken" means except this 2 select all others field.
    const createdUser = await User.findById(user._id).select(" -password -refreshToken");
  
    // Check user creation | Checking the entry is successfully registered in DB or not
    if (!createdUser) throw new ApiError(500, "User Registration Faild.");
  
    return res.status(201).json(new ApiResponse(200, createdUser, "User Registration Successfull.",))
  } catch (error) {
    deleteLocalTempFiles(req);
    throw new ApiError(error.statusCode, error.message)
  }

})


// Access and refresh token generation function
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)
    // If password is correct then generate accessToken and refreshToken
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    // Save refreshToken in DB
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Access and refresh token generation faild.");
  }
}

// Secure Options, helps while we save a cookie
const options = {
  httpOnly: true,
  secure: false
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
  const loggedInUser = user.toObject(); // Shallow Copy
  delete loggedInUser.password;
  delete loggedInUser.refreshToken;

  console.log("User ", loggedInUser.username, " Login Successfull.")
  // Return response (accessToken and user details except user password and refreshToken details)
  return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            loggedInUser,
            accessToken,
            refreshToken
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
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: null
      }
    }
  );


  // Remove cookies and rend response.
  res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Logged Out."))

})


// Access token renew process 
const renewAccessRefreshToken = asyncHandler(async (req, res) => {
  // console.log("Cookies => ",req.cookies);
  // console.log("Body => ",req.body);

  // RefreshToken Save in cookies.[req.cookies.refreshToken] || If the request comming form web app then it store in req.body. 
  const encodedRfToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!encodedRfToken) throw new ApiError(401, "Unauthorized request.")

  try {
    // Decode encoded refreshToken.
    const decodedRfToken = jwt.verify(encodedRfToken, process.env.REFRESH_TOKEN_SECRET); // Ye "_id" return karega object form me. Because: While generating refreshToken we use "_id: this._id" payload.

    const actualUserObject = await User.findById(decodedRfToken._id);

    if (!actualUserObject) throw new ApiError(401, "Invalid Refresh Token.")

    if (encodedRfToken !== actualUserObject.refreshToken) throw new ApiError(401, "Refresh token is expired or used.")

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(actualUserObject._id)


    res.status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(
        200,
        {
          accessToken,
          refreshToken
        },
        "Access and RefreshToken Renewed Successfully."
      ))

  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }

});


// Change Password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  console.log("Change Password res.body => ", req.body);

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) throw new ApiError(400, "Password fields required");

  if (oldPassword === newPassword) throw new ApiError(400, "Unchanged Password.")

  console.log("Verify user details:(without password and refreshtoken) ", req.user);

  // Strong passworc validation
  passwordValidation(newPassword, 6);

  const currentUser = await User.findById(req.user._id);

  const isPassCorrect = await currentUser.isPasswordCorrect(oldPassword);

  if (!isPassCorrect) throw new ApiError(400, "Incorrect Password.")

  currentUser.password = newPassword;
  await currentUser.save({ validateBeforeSave: false });
  console.log("User ", currentUser.username, " Password changed form ", oldPassword, " to ", newPassword)
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

  const user = await User.findById(req.user._id)

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const { trimFullName, trimEmail } = await checkNameAndEmailFormat(fullName, email);

  user.fullName = trimFullName ? trimFullName : user.fullName
  user.email = trimEmail ? trimEmail : user.email
  await user.save({ validateBeforeSave: false })


  console.log("Info updated.")
  return res.status(200)
    .json(new ApiResponse(
      200,
      user,
      "Details Update Successfully."
    ))
})


// File update utility
const updateFiles = async (file, id) => {

  console.log("File ==> ", file);

  const localFilePath = file?.path;
  const updateFieldName = file?.fieldname;

  if (!localFilePath) throw new ApiError(400, "File is missing.")

  const uploadedFile = await uploadOnCloudinary(localFilePath)

  if (!uploadedFile.url) throw new ApiError(400, "Error in uploading process.")

  console.log("Fild Name: ", updateFieldName)

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
const getUserChannelDetails = asyncHandler(async (req, res) => {
  console.log("User Channel Req: => ", req.params)
  const { username } = req.params;

  if (!username?.length) throw new ApiError(404, "Username Not FOund.")

  const user = await User.aggregate([
    {
      $match: {
        username: username.trim().toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribed"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        subscribedCount: {
          $size: "$subscribed"
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"]
            },
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        username: 1,
        email: 1,
        fullName: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedCount: 1,
        isSubscribed: 1,
      }
    }
  ])

  if (!user?.length) throw new ApiError(404, "User doesn't exists.")

  console.log("User '", user[0].username, "' Details: ", user);

  return res.status(200)
    .json(new ApiResponse(
      200,
      user[0],
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


// PROCESS: To perform forgot password we use to methods forgotUserPassword,resetPassword.
// forgotUserPassword , when user click on forgot password, frontend send a POST request to (/forgot-password). It generate token, saved in db, send user a reset link or otp.
// Then when user click on the link frontend again send a post request to (/reset-password). It validate your pass and reset your pass.
// If it is otp based, then frontend opens a form page to put otp and varify otp then reset the password. 
const forgotUserPassword = asyncHandler(async (req, res) => {
  // Forgot Password using OTP. ||  Forgot Password using url. 
  // Use crypto.randomInt() for secure random number generation || crypto.randomBytes(32) for reset token generation
  // Store hash otp in db. || Store reset token in db
  // Send otp to user email || Send reset link to user email
  const { email } = req.body;
  const user = await User.findOne({ email }).select("-password -refreshToken");
  if (user) {
    // URL Method
    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    // Hash token and store in db
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const validity = (10 * 60 * 1000); // In miliseconds
    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = Date.now() + validity;
    await user.save({ validateBeforeSave: false })

    // NEED TO BE CHANGE
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    // Send Mail
    const message = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password:</p>

      <a href="${resetUrl}" 
        style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">
        Reset Password
      </a>

      <p>If the button doesn't work, copy this link:</p>
      <p>${resetUrl}</p>

      <p>This link will expire in ${validity/60000} minutes.</p>
    </div> `;
    await sendMail({to: email, subject: "Reset Password", html: message})
  }

  return res.status(200)
    .json(new ApiResponse(
      200,
      user,
      "Reset Link send to your registered email address."
    )
    )
})
// verify OTP validity. and make it Invalidate OTP after successful use. || No need to verify, directly reset password. 
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  //Password Validation
  passwordValidation(newPassword);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  }).select("-password -refreshToken")

  if (!user) throw new ApiError(400, "Token is invalid or expired");

  user.password = newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  await user.save();

  return res.status(200).json(new ApiResponse(200, user, "Password Reset Successfully."))
})



export {
  registerUser,
  loginUser,
  logoutUser,
  renewAccessRefreshToken,
  changeCurrentPassword,
  getCurrentUser,
  updateData,
  updateAvatar,
  updateCoverImage,
  getUserChannelDetails,
  getWatchHistory,
  forgotUserPassword,
  resetPassword,
};