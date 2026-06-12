import mongoose from "mongoose";
import { Video } from "../models/video.model.js"
import { WatchHistory } from "../models/watchHistory.model.js"
import {
  ApiError,
  ApiResponse,
  asyncHandler
} from "../utils/index.js"


export const updateWatchHistory = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  await WatchHistory.findOneAndUpdate(
    {
      user: req.user?._id,
      video: videoId,
    },
    {
      watchedAt: new Date(),
    },
    {
      upsert: true,
    }
  );


  return res.status(200).json(new ApiResponse(
    200,
    {},
    "Watch history updated"
  ));
});



export const getWatchHistory = asyncHandler(async (req, res) => {

  if (!req.user?._id) throw new ApiError(403, "Unauthorized.")

  const days = Number(req.query.days) || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const history = await WatchHistory.find(
    {
      user: req.user._id,
      watchedAt: {
        $gte: startDate,
      }
    })
    .sort({
      watchedAt: -1,
    })
    .populate(
      {
        path: "video",

        select: "title thumbnail views duration owner createdAt",

        populate: {
          path: "owner",
          select: "username fullName avatar",
        },
      }
    );


  return res.status(200).json(new ApiResponse(
    200,
    history,
    "Watch history fetched"
  ));
});


// Clear Watch History: Deletes ALL WatchHistory documents for the logged-in user.
export const clearWatchHistory = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(403, "Unauthorized.");
 
  await WatchHistory.deleteMany({ user: req.user._id });
 
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Watch history cleared."));
});


// Toggle Pause History
// Flips the watchHistoryPaused boolean on the User model.
// When paused, the updateWatchHistory endpoint should skip recording.
export const togglePauseHistory = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(403, "Unauthorized.");
 
  const user = await User.findById(req.user._id).select("watchHistoryPaused");
  if (!user) throw new ApiError(404, "User not found.");
 
  user.watchHistoryPaused = !user.watchHistoryPaused;
  await user.save({ validateBeforeSave: false });
 
  return res.status(200).json(
    new ApiResponse(
      200,
      { paused: user.watchHistoryPaused },
      user.watchHistoryPaused
        ? "Watch history paused."
        : "Watch history resumed."
    )
  );
});