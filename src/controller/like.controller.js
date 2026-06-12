import { ApiError, ApiResponse, asyncHandler } from "../utils/index.js"
import { Like } from "../models/like.model.js"
import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"
import { User } from "../models/user.model.js"
import redisClient from "../db/redis.js"

const toggleLike = async (modelId, fieldName, userId, model) => {

  const allowedFields = ["video", "comment"]
  if (!allowedFields.includes(fieldName)) throw new ApiError(400, "Invalid like field type")

  if (!isValidObjectId(modelId)) throw new ApiError(400, `Invalid ${fieldName} ID.`)


  const session = await mongoose.startSession()
  let existingDocument;
  try {
    session.startTransaction()

    existingDocument = await model.findById(modelId, null, { session })
    if (!existingDocument) throw new ApiError(404, `${fieldName} not found`)
    // Try to delete first
    const deletedLike = await Like.findOneAndDelete({
      [fieldName]: modelId,
      likedBy: userId
    }, { session })

    //If nothing found in deletedLike then create a new like.
    if (!deletedLike) {
      await Like.create(
        [{
          [fieldName]: modelId,
          likedBy: userId
        }],
        { session })

      const result = await model.findByIdAndUpdate(
        modelId,
        {
          $inc: {
            likes: 1
          }
        },
        {
          returnDocument: "after",
          session
        }
      )

      // Creating Key for like sync
      if (fieldName === "video") await redisClient.sAdd("dirty:users", userId.toString())
        
      await session.commitTransaction()
      return { liked: true, totalLikes: result.likes }
    }

    const result = await model.findByIdAndUpdate(
      modelId,
      {
        $inc: {
          likes: -1
        }
      },
      {
        returnDocument: "after",
        session
      }
    )

    await session.commitTransaction()
    return { liked: false, totalLikes: result.likes }
  }
  catch (error) {
    await session.abortTransaction()
    if (error.code === 11000) {
      return { liked: true, totalLikes: existingDocument.likes + 1 }
    }
    throw error
  }
  finally {
    await session.endSession()
  }
}


const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthenticated.")
  }

  const result = await toggleLike(videoId, "video", req.user._id, Video)

  return res.status(200).json(new ApiResponse(
    200,
    result,
    result.liked ? "Video liked." : "Video unliked."
  ))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthenticated.")
  }

  const result = await toggleLike(commentId, "comment", req.user._id, Comment)

  return res.status(200).json(new ApiResponse(
    200,
    result,
    result.liked ? "Comment liked." : "Comment unliked."
  ))
})


const getLikedVideos = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new ApiError(401, "Unauthenticated.")

  let { limit = 20, lastId } = req.query
  limit = Math.min(parseInt(limit) || 20, 50)

  const filter = { video: { $exists: true, $ne: null }, likedBy: req.user._id }

  if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(lastId) }
  }

  const likedDocs = await Like.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("video", "title thumbnail views duration owner isPublished")
    .lean()

  const videos = likedDocs.map(item => item.video).filter(Boolean)

  const nextCursor = likedDocs.length === limit
    ? { lastId: likedDocs[likedDocs.length - 1]._id }
    : null

  return res.status(200).json(new ApiResponse(200, { videos, nextCursor }, "Liked videos fetched."))
})

const getLikeStatus = asyncHandler(async (req, res) => {
  const { videoId, commentId } = req.query

  if (!videoId && !commentId)
    throw new ApiError(400, "Provide videoId or commentId.")

  // ✅ Validate whichever ID was passed
  if (videoId && !mongoose.Types.ObjectId.isValid(videoId))
    throw new ApiError(400, "Invalid video ID.")

  if (commentId && !mongoose.Types.ObjectId.isValid(commentId))
    throw new ApiError(400, "Invalid comment ID.")

  const filter = { likedBy: req.user._id }
  if (videoId) filter.video = videoId
  if (commentId) filter.comment = commentId

  const like = await Like.findOne(filter).lean()

  return res.status(200).json(
    new ApiResponse(200, { isLiked: !!like }, "Like status fetched.")
  )
})

export {
  toggleVideoLike,
  toggleCommentLike,
  getLikedVideos,
  getLikeStatus
}