import { ApiError, ApiResponse, asyncHandler } from "../utils/index.js"
import { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

  if(!req.user?._id) throw new ApiError(403, "Forbidden")

  const channelDetails = await User.findById( req.user._id ).select( "-password -refreshToken -watchHistory" )

  if (!channelDetails) throw new ApiError(404, "Channel not found.")

  return res.status(200).json(new ApiResponse(
    200,
    channelDetails,
    "Channel status fetched successfully."
  ))
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
  
  if(!req.user?._id) throw new ApiError(403, "Forbidden")

  const channelVideos = await Video.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean()

  return res.status(200).json(new ApiResponse(
    200,
    channelVideos,
    "Videos fetched successfully."
  ))
})

export {
  getChannelStats,
  getChannelVideos,
}