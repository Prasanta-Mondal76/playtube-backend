import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";


// This middleware help us to find the user and validate the user. 

export const verifyJWT = asyncHandler ( async (req, res, next) => {
  try {
    // Finding the access token
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer", "").trim();

    if(!token) throw new ApiError(404, "Unauthorized Request.");

    // Verifying the access token is valid or not. 
    // If user is valid then it returns A object with the values we set while generating the access token.(in user.model)
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Finding the user in database.
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

    if(!user) {
      throw new ApiError(404, "User not found.")
    }

    // If user add Object field in request. So now everyone can access it.
    req.user = user; // Adding a new field "user" in requesi file. 

    next();
  } catch (error) {
    throw new ApiError( 401 , "Error in verify user process.");
  }
})