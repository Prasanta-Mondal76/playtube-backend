import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";


const checkNameAndEmailFormat = async (fullName, email) =>{
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
    if(trimEmail !== trimEmail.toLowerCase()) throw new ApiError(400, "Email must be in lowercase")

    const isUnique = await User.findOne({email: trimEmail})
    if(isUnique) throw new ApiError(409, "Email already exists.")
  }
  return {trimFullName, trimEmail};
}

const passwordValidation = (pass, len) => {
  // const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?&])\S{8,}$/;
  const regex = new RegExp(`^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@$!%*?&])\S{${len},}$`)
  if(!regex.test(regex)) throw new ApiError(400, `Password must be >=${len} and contains upparcase. lowercase, numbers and spetial characters.`)
  return;
}

// Register User 
const registerUser = asyncHandler(async (req, res) => {
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
  const {trimFullName, trimEmail} =  await checkNameAndEmailFormat(fullName, email);

  // Strong Password Validation
  passwordValidation(password);

  //Checking User already exists or not
  const isExists = await User.findOne({
    $or: [
      { username },
      { email }
    ]
  })

  if (isExists) throw new ApiError(409, "Username or Email already exists. Please login.");

  // Checking for images , Checking for avatar
  // console.log("-------------------------------Multer req.body --------------------------------- \n ",req.body);
  // console.log("-------------------------------Multer req.files --------------------------------- \n ",req.files);
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  //checking required image file avatar
  if (!avatarLocalPath) {
    if (coverImageLocalPath) fs.unlinkSync(coverImageLocalPath) //If avatar image is not present then remove the cover image from local storage if it is present
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
    email : trimEmail,
    fullName : trimFullName,
    avatar: avatarImage.url,
    coverImage: coverImages?.url || "",
    password,
  })

  // Removed Password and RefreshToken field | User.findById(user._id) it find the user with the _id which db automatically add. ".select()" select all fields of user. "-password -refreshToken" means except this 2 select all others field.
  const createdUser = await User.findById(user._id).select(" -password -refreshToken");

  // Check user creation | Checking the entry is successfully registered in DB or not
  if (!createdUser) throw new ApiError(500, "User Registration Faild.");

  return res.status(201).json(new ApiResponse(200, createdUser, "User Registration Successfull.",))

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

    return {accessToken, refreshToken};
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


  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

  // Creating a new object to send in response After removing password and refreshToken from user details

  // // Method 1: Using db query.
  // const loggedInUser = User.findById(user._id).select("-password -refreshToken");

  // Method 2: By copying user object.
  const loggedInUser = user.toObject(); // Shallow Copy
  delete loggedInUser.password;
  delete loggedInUser.refreshToken;

console.log("User ",loggedInUser.username," Login Successfull.")
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
  
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(actualUserObject._id)
  
  
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
const changeCurrentPassword = asyncHandler ( async (req, res) => {
  console.log("Change Password res.body => ",req.body);

  const {oldPassword, newPassword} = req.body;

  if(!oldPassword || !newPassword) throw new ApiError(400, "Password fields required");

  if(oldPassword === newPassword) throw new ApiError(400, "Unchanged Password.")

  console.log("Verify user details:(without password and refreshtoken) ",req.user);

  // Strong passworc validation
  passwordValidation(newPassword);

  const currentUser = await User.findById(req.user._id);

  const isPassCorrect = await currentUser.isPasswordCorrect(oldPassword);

  if(!isPassCorrect) throw new ApiError(400, "Incorrect Password.")

  currentUser.password = newPassword;
  await currentUser.save({validateBeforeSave: false});
console.log("User ",currentUser.username, " Password changed form ",oldPassword," to ",newPassword)
  res.status(200)
      .json(new ApiResponse(
        200,
        {},
        "Password Updated Successfully."
      ))
})


// Get current user details function 
const getCurrentUser = asyncHandler( async(req, res) => {
  return res.status(200)
            .json(new ApiResponse(
              200,
              req.user,
              "Current user fatched Successfully."
            ))
})


// Update fullName & email info
const updateData = asyncHandler (async (req, res) => {
  const {fullName, email} = req.body;
  
  if(!(fullName || email)) throw new ApiError(400, "Please provide at least one field to update");

  const user = await User.findById(req.user._id)

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const {trimFullName, trimEmail} = await checkNameAndEmailFormat(fullName, email);

  user.fullName = trimFullName? trimFullName : user.fullName
  user.email = trimEmail? trimEmail : user.email
  await user.save({validateBeforeSave: false})


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
  
  console.log("File ==> ",file);

  const localFilePath = file?.path;
  const updateFieldName = file?.fieldname;

  if(!localFilePath) throw new ApiError(400, "File is missing.")
  
  const uploadedFile = await uploadOnCloudinary(localFilePath)

  if(!uploadedFile.url) throw new ApiError(400, "Error in uploading process.")

    console.log("Fild Name: ",updateFieldName)

  const user = await User.findById(id).select("-password -refreshToken")

  if(!user) throw new ApiError(400, "User not found in update file Process.")

  const oldUrl = user[updateFieldName];

  user[updateFieldName] = uploadedFile.url
  await user.save({validateBeforeSave: false})
  
  await deleteFromCloudinary(oldUrl);
  return user;
}

// Update Avatar
const updateAvatar = asyncHandler ( async (req, res) => {
  const resObj = await  updateFiles(req.file, req.user._id);

  res.status(200).json(new ApiResponse(200, resObj, "Avatar Updated Successfully."))
})

// Update Covered Image
const updateCoverImage = asyncHandler ( async (req, res) => {
  const resObj = await updateFiles(req.file, req.user._id);

  res.status(200).json(new ApiResponse(200, resObj, "Covered Image Updated Successfully."))
})


export 
{ 
  registerUser, 
  loginUser, 
  logoutUser, 
  renewAccessRefreshToken, 
  changeCurrentPassword, 
  getCurrentUser,
  updateData,
  updateAvatar,
  updateCoverImage,

};