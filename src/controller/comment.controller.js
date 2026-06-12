import { ApiError, ApiResponse, asyncHandler, verifyToken } from "../utils/index.js"
import { Comment } from "../models/comment.model.js"
import mongoose from "mongoose"


const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body
  const { videoId } = req.params

  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ApiError(400, "Invalid video ID.")
  if (!content?.trim()) throw new ApiError(400, "Invalid comment.")
  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user._id
  })

  return res.status(201).json(new ApiResponse(201, comment, "Comment created successfully."))
})

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params
  const { content } = req.body
  if (!mongoose.Types.ObjectId.isValid(commentId)) throw new ApiError(400, "Invalid comment ID.")
  if (!content?.trim()) throw new ApiError(400, "Invalid comment.")

  const comment = await Comment.findOneAndUpdate(
    {
      _id: commentId,
      owner: req.user._id
    },
    {
      $set: {
        content
      }
    },
    {
      runValidators: true,
      returnDocument: 'after'
    }
  )

  if (!comment) throw new ApiError(404, "Comment not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully."))
})

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params

  if (!mongoose.Types.ObjectId.isValid(commentId)) throw new ApiError(400, "Invalid comment ID.")

  const comment = await Comment.findOneAndDelete(
    {
      _id: commentId,
      owner: req.user._id
    }
  )

  if (!comment) throw new ApiError(404, "Comment not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, comment, "Comment deleted successfully."))
})

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  let { limit = 20, lastValue, lastId } = req.query

  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ApiError(400, "Invalid video ID.")

  let currentUser
  if(req.cookies?.accessToken){
    currentUser = await verifyToken(req.cookies.accessToken)
  }
  const userId = currentUser?._id

  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit) || 20))
  let parsedLastId = null
  if (lastId && mongoose.Types.ObjectId.isValid(lastId))
    parsedLastId = new mongoose.Types.ObjectId(lastId)

  const filter = { video: new mongoose.Types.ObjectId(videoId) }

  if (lastValue && parsedLastId) {
    const date = new Date(lastValue)
    if (!isNaN(date)) {
      filter.$or = [
        { createdAt: { $lt: date } },
        { createdAt: date, _id: { $lt: parsedLastId } }
      ]
    }
  }

  const comments = await Comment.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: parsedLimit },
    // Join owner info
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        pipeline: [{
          $project:
          {
            username: 1,
            avatar: 1,
            fullName: 1
          }
        }],
        as: "owner"
      }
    },
    { $unwind: "$owner" },

    // Check if current user liked each comment. This part add a field -> isLike: true/false. Means Current user Liked the comment or not
    ...(userId ?
      [{
        $lookup: {
          from: "likes",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$comment", "$$commentId"] },
                    { $eq: ["$likedBy", userId] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "userLike"
        }
      },
      {
        $addFields: { isLiked: { $gt: [{ $size: "$userLike" }, 0] } }
      },
      { $project: { userLike: 0 } }
      ] :
      [
        { $addFields: { isLiked: false } }
      ]
    )
  ])


  return res.status(200).json(new ApiResponse(200, comments, "Comments fetched successfully."))
})

export {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment
}