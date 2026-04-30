import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { deleteLocalTempFiles } from "../utils/deleteTempFiles.js";
import mongoose from "mongoose";


const publishAVideo = asyncHandler(async (req, res) => {
  try {
    const { title, description, isPublished } = req.body

    if (!req.files || !req.files?.videoFile?.length) throw new ApiError(400, "Video Files is required.")

    //Validation of details
    const autoTitle = req.files.videoFile?.[0]?.originalname || "Untitled";

    const videoPath = req.files.videoFile?.[0]?.path;
    const thumbnailPath = req.files.thumbnail?.[0]?.path;

    if (!videoPath) {
      throw new ApiError(400, "Video file is required.")
    }

    const videoResponse = await uploadOnCloudinary(videoPath)

    const thumbnailResponse = thumbnailPath ? await uploadOnCloudinary(thumbnailPath) : undefined;

    // Duration In seconds
    const duration = videoResponse?.duration ? parseInt(videoResponse.duration) : 0;

    const video = await Video.create({
      videoFile: videoResponse.url,
      thumbnail: thumbnailResponse?.url,
      title: title || autoTitle,
      description,
      duration,
      views: 0,
      isPublished: isPublished ?? true
    })

    if (!video) throw new ApiError(500, "Error in publishing video.")

    return res.status(200).json(new ApiResponse(200, video, "Video Uploaded Successfully."))
  } catch (error) {
    deleteLocalTempFiles(req);
    throw error;
  }
})


const getAllVideos = asyncHandler(async (req, res) => {

  // // Videos Fatched Using Skip method. It's easy and sutable for small and medium size data. 
  // const {page = 1, limit = 5, sortBy, sortType} = req.query;
  // const skip = (page - 1) * limit;
  // const videos = await Video.find().sort({[sortBy] : sortType === "asc" ? 1 : -1}).skip(skip).limit(limit);

  // return res.status(200).json(new ApiResponse(200, videos, `${videos.length} videos fatched successfully.`))


  // Usrin query object, By storing last id of fatch videos. Works fine for large data.

  let { limit = 10, sortBy = "_id", sortType = "desc", lastValue, lastId } = req.query;

  limit = parseInt(limit);
  const sortOrder = sortType === "asc" ? 1 : -1;

  const allowedFields = ["_id", "title", "duration", "createdAt"];
  if (!allowedFields.includes(sortBy)) {
    sortBy = "_id";
  }

  // Step 1: Query build karo
  let parsedLastId = null;

  if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
    parsedLastId = new mongoose.Types.ObjectId(lastId);
  }
  // type conversion
  if (sortBy === "_id" && parsedLastId) {
    lastValue = parsedLastId;
  }

  if (sortBy === "duration" && lastValue !== undefined) {
    lastValue = Number(lastValue);
  }

  if (sortBy === "createdAt" && lastValue) {
    lastValue = new Date(lastValue);
  }


  let query = {};

  if (sortBy === "_id") {
    // Sirf _id pe sort — simple cursor, $or ki zaroorat nahi
    if (parsedLastId) {
      query = { _id: sortOrder === 1 ? { $gt: parsedLastId } : { $lt: parsedLastId } };
    }
  } else {
    //  parsedLastId ke saath lastValue DONO check karo
    if (lastValue !== undefined && lastValue !== null && parsedLastId) {
      query = {
        $or: [
          { [sortBy]: sortOrder === 1 ? { $gt: lastValue } : { $lt: lastValue } },
          {
            [sortBy]: lastValue,
            _id: sortOrder === 1 ? { $gt: parsedLastId } : { $lt: parsedLastId }
          }
        ]
      };
    }
  }

  // Step 2: DB call
  const videos = await Video.find(query)
    .sort({ [sortBy]: sortOrder, _id: sortOrder })
    .limit(limit);

  // Step 3: next cursor nikalo
  let nextCursor = null;

  if (videos.length === limit) {
    const lastItem = videos[videos.length - 1];

    nextCursor = {
      lastValue: lastItem[sortBy],
      lastId: lastItem._id
    };
  }

  // Step 4: response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        videos,
        nextCursor
      },
      `${videos.length} videos fetched successfully`
    )
  );
});


const updateVideoDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  //TODO: update video details like title, description, thumbnail
  if (!videoId) throw new ApiError(400, "No VideoId Provided. ")
  const { thumbnail, title, description } = req.body

  const updateFields = {};

  if (thumbnail !== undefined && (thumbnail !== "")) updateFields.thumbnail = thumbnail;
  if (title !== undefined && (title !== "")) updateFields.title = title;
  if (description !== undefined && (description !== "")) updateFields.description = description;

  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(400, "No fields provided for update");
  }

  const video = await Video.findByIdAndUpdate(
    {
      _id: videoId,
      owner: req.user._id,
    },
    {
      $set: updateFields
    },
    {
      after: true,
    }
  );

  if (!video) throw new ApiError(404, "Video Not Found or Unauthorized Video Access.")

  return res.status(200).json(new ApiResponse(200, video, "Video Details Updated Successfully."))
})


export {
  publishAVideo,
  getAllVideos,
  updateVideoDetails,
}