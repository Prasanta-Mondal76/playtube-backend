import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { deleteLocalTempFiles } from "../utils/deleteTempFiles.js";



const publishAVideo = asyncHandler(async (req, res) => {
  try {
    const { title, description, isPublished } = req.body
    
    if(!req.files || !req.files?.videoFile?.length) throw new ApiError(400, "Video Files is required.")
  
    //Validation of details
    const autoTitle = req.files.videoFile?.[0]?.originalname || "Untitled";
    
    const videoPath = req.files.videoFile?.[0]?.path;
    const thumbnailPath = req.files.thumbnail?.[0]?.path;
    
    if(!videoPath) {
      throw new ApiError(400, "Video file is required.")
    }
  
    const videoResponse = await uploadOnCloudinary(videoPath)
  
    const thumbnailResponse = thumbnailPath? await uploadOnCloudinary(thumbnailPath) : undefined;
  
    // Duration In seconds
    const duration = videoResponse?.duration ? parseInt(videoResponse.duration) : 0;
  
    const video = await Video.create({
      videoFile: videoResponse.url,
      thumbnail: thumbnailResponse?.url,
      title: title || autoTitle,
      description,
      duration,
      views:0,
      isPublished: isPublished ?? true
    })
  
    if(!video) throw new ApiError(500, "Error in publishing video.")
  
    return res.status(200).json(new ApiResponse(200, video, "Video Uploaded Successfully.")) 
  } catch (error) {
    deleteLocalTempFiles(req);
    throw error;
  }
})












export {
  publishAVideo,
}