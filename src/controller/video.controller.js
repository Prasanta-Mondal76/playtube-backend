import {
  ApiError, ApiResponse, asyncHandler,
  uploadOnCloudinary, deleteLocalTempFiles, deleteFromCloudinary,
  syncAVideoViewsToMongoDB,
  verifyToken
} from "../utils/index.js"
import { Video } from "../models/video.model.js";
import mongoose, { isValidObjectId } from "mongoose";
import redisClient from "../db/redis.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Subscription } from "../models/subscription.model.js";



const publishAVideo = asyncHandler(async (req, res) => {
  let videoResponse, thumbnailResponse;
  try {
    const startTime = Date.now()
    const { title, description, isPublished } = req.body

    if (!req.user?._id) throw new ApiError(400, "Please login first.")
    if (!req.files || !req.files?.videoFile?.length) throw new ApiError(400, "Video Files is required.")

    //Validation of details
    const autoTitle = req.files.videoFile?.[0]?.originalname || "Untitled";

    const videoPath = req.files.videoFile?.[0]?.path;
    const thumbnailPath = req.files.thumbnail?.[0]?.path;

    if (!videoPath) {
      throw new ApiError(400, "Video file is required.")
    }

    videoResponse = await uploadOnCloudinary(videoPath)

    thumbnailResponse = thumbnailPath ? await uploadOnCloudinary(thumbnailPath) : undefined;

    // Duration In seconds
    let duration = videoResponse?.duration ? parseInt(videoResponse.duration) : 0;

    // Video Duration Formating
    function formatDuration(totalSeconds) {

      const hours = Math.floor(totalSeconds / 3600);

      const minutes = Math.floor((totalSeconds % 3600) / 60);

      const seconds = totalSeconds % 60;

      // Add leading zero
      const paddedMinutes = String(minutes).padStart(2, "0");
      const paddedSeconds = String(seconds).padStart(2, "0");

      // If video has hours
      if (hours > 0) {
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
      }

      return `${minutes}:${paddedSeconds}`;
    }

    if (duration) duration = formatDuration(duration)

    const video = await Video.create({
      videoFile: videoResponse.url,
      thumbnail: thumbnailResponse?.url,
      title: title || autoTitle,
      description,
      duration,
      views: 0,
      isPublished: isPublished ?? true,
      owner: req.user._id
    })

    if (video) {
      await User.findByIdAndUpdate(video.owner, {
        $inc: {
          totalVideos: 1,
          totalPublishedVideos: video.isPublished ? 1 : 0
        }
      })
    }

    return res.status(201).json(new ApiResponse(
      201,
      {
        video,
        responseTime: (Date.now() - startTime)
      },
      "Video Uploaded Successfully."
    ))
  } catch (error) {

    // Clean Up Cloudinary Files 
    if (videoResponse) {
      await deleteFromCloudinary(videoResponse.url)
        .catch((err) => console.log("Cloudinary video file deletion faild. Error -> ", err))
    }
    if (thumbnailResponse) {
      await deleteFromCloudinary(thumbnailResponse.url)
        .catch((err) => console.log("Cloudinary thumbnail deletion faild. Error -> ", err))
    }

    // Clean Up Temp Files.
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
  query.isPublished = true

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
  const videos = await Video.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "users",

        let: {
          ownerId: "$owner"
        },

        pipeline: [

          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$ownerId"]
              }
            }
          },

          // Fetch ONLY required fields
          {
            $project: {
              avatar: 1,
              username: 1,
              fullName: 1
            }
          }

        ],

        as: "owner"
      }
    },

    {
      $unwind: "$owner"
    }

  ])
    .sort({ [sortBy]: sortOrder, _id: sortOrder })
    .limit(limit);

  // Step 3: next cursor nikalo
  let nextCursor = null;

  if (videos.length === limit) {
    const lastItem = videos[videos.length - 1];

    nextCursor = {
      lastValue: lastItem.title,
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

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const { title, description } = req.body

  const updateFields = {};

  if (title !== undefined && title.trim() !== "") updateFields.title = title.trim();
  if (description !== undefined && description.trim() !== "") updateFields.description = description.trim();

  // Handle thumbnail file upload
  if (req.file?.path) {
    const thumbnailResponse = await uploadOnCloudinary(req.file.path);

    if (!thumbnailResponse?.url) {
      deleteLocalTempFiles(req);
      throw new ApiError(500, "Thumbnail upload to Cloudinary failed.");
    }

    // Delete old thumbnail from Cloudinary
    const existingVideo = await Video.findById(videoId).select("thumbnail");
    if (existingVideo?.thumbnail) {
      await deleteFromCloudinary(existingVideo.thumbnail).catch((err) => console.log("Old thumbnail deletion failed:", err));
    }

    updateFields.thumbnail = thumbnailResponse.url;
  }

  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(400, "No fields provided for update");
  }

  const video = await Video.findOneAndUpdate(
    {
      _id: videoId,
      owner: req.user._id,
    },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!video) throw new ApiError(404, "Video Not Found or Unauthorized Video Access.")

  return res.status(200).json(new ApiResponse(200, video, "Video Details Updated Successfully."))
})

const togglePublishStatus = asyncHandler(async (req, res) => {

  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video ID");

  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const video = await Video.findOne({
      _id: videoId,
      owner: req.user._id
    }).session(session);

    if (!video) {
      throw new ApiError(
        404,
        "Video Not Found or Unauthorized Video Access."
      );
    }

    video.isPublished = !video.isPublished;

    await video.save({ session });

    await User.findByIdAndUpdate(
      video.owner,
      {
        $inc: {
          totalPublishedVideos:
            video.isPublished ? 1 : -1
        }
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json(
      new ApiResponse(
        200,
        video,
        "Toggle successful."
      )
    );

  }
  catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, "Toggle publish status failed.");
  }
  finally {
    await session.endSession();
  }

});


const deleteVideo = asyncHandler(async (req, res) => {
  const startTime = Date.now()

  const { videoId } = req.params
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  // Sync Views to DB before deleted.
  await syncAVideoViewsToMongoDB(videoId)

  const session = await mongoose.startSession()
  try {
    session.startTransaction()
    // Video Finding 
    const video = await Video.findOneAndDelete({
      _id: videoId,
      owner: req.user._id
    }).session(session)
    if (!video) throw new ApiError(404, "Video Not Found or Unauthorized Video Access.")

    // Fetching all comments of the video. Only return "_id".
    const comments = await Comment.find(
      { video: videoId },
      "_id",
      { session }
    ).lean()
    // make a array of comments by takins it's  _id
    const commentIds = comments.map(c => c._id)

    await Promise.all([
      // decrease video count
      User.findByIdAndUpdate(video.owner, {
        $inc: {
          totalVideos: -1,
          totalPublishedVideos: video.isPublished ? -1 : 0
        }
      }, { session }),

      // Delete video likes
      Like.deleteMany({
        video: videoId
      }, { session }),

      // Delete comments of the video
      Comment.deleteMany({
        video: videoId
      }, { session }),

      // Delete Likes of deleted comments
      Like.deleteMany({
        comment: { $in: commentIds }
      }, { session }),

      // Delete video from all playlist
      Playlist.updateMany(
        { videos: videoId },
        {
          $pull: { videos: videoId }
        },
        { session }
      )
    ])

    await session.commitTransaction()
    // AFTER successful commit delete video and thumbnail from cloudinary
    await Promise.all([
      deleteFromCloudinary(video.videoFile),
      deleteFromCloudinary(video.thumbnail)
    ])

    return res.status(200).json(new ApiResponse(
      200,
      {
        video,
        responseTime: (Date.now() - startTime)
      },
      "Video deleted successfully."
    ))
  }
  catch (error) {
    await session.abortTransaction()
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to delete video"
    )
  }
  finally {
    await session.endSession()
  }

})


const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findOne({
    _id: videoId,
    $or: [
      { isPublished: true },

      // Video owner can access of his own unpublished videos also.
      { owner: req.user?._id }
    ]
  }).populate("owner", "_id fullName username avatar totalSubscribers").lean()
  if (!video) throw new ApiError(404, "Video Not Found.")

  let currentUser;
  if (req.cookies?.accessToken) {
    currentUser = await verifyToken(req.cookies.accessToken)
  }
  const userId = currentUser?._id

  let isLiked = false
  let isSubscribed = false
  let isOwner = false
  if (userId) {
    const like = await Like.findOne({ video: videoId, likedBy: userId }).lean()
    const subs = await Subscription.findOne({ subscriber: userId, channel: video.owner._id })
    isLiked = !!like;
    isSubscribed = !!subs;
    isOwner = userId.toString() === video.owner._id.toString()

  }

  return res.status(200).json(new ApiResponse(
    200,
    {
      ...video,
      isLiked,
      isSubscribed,
      isOwner
    },
    "Video fatched successfully."
  ))
})

// Views Count Method using Redis
const recordVideoView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video ID")

  // Create Unique Key
  const uniqueViewerKey = req.user?._id
    ? `viewed:${videoId}:${req.user._id}`
    : `viewed:${videoId}:${req.ip}`

  // If key not exists, create it and return OK. Otherwise: return null
  const isNewView = await redisClient.set(
    uniqueViewerKey,
    "true",
    {
      EX: 86400,
      NX: true
    }
  )

  // If Already Viewed
  if (!isNewView) {
    return res.status(200).json(
      new ApiResponse(
        200,
        null,
        "View already counted"
      )
    )
  }

  const viewsKey = `video:${videoId}:views`

  // Check Redis views exists or not
  const redisViewsExists = await redisClient.exists(viewsKey)

  // If Redis lost data / first time load
  if (!redisViewsExists) {

    const video = await Video.findById(videoId).select("views")
    if (!video) {
      await redisClient.del(uniqueViewerKey)
      throw new ApiError(404, "Video not found")
    }

    // Warm Redis cache using MongoDB value
    await redisClient.set(
      viewsKey,
      video?.views || 0
    )
  }

  // Increment views
  await redisClient.incr(viewsKey)

  await Promise.all([
    // Set a timer of 7 days for this key
    redisClient.expire(viewsKey, 604800),

    // Mark video as changed
    redisClient.sAdd("dirty:videos", videoId),

  ])

  return res.status(200).json(new ApiResponse(
    200,
    null,
    "Views recorded successfully"
  ))
})


const getChannelVideos = asyncHandler(async (req, res) => {
  let {
    limit = 30,
    sortBy = "_id",
    sortType = "desc",
    lastValue,
    lastId
  } = req.query;

  const { channelId } = req.params;

  // Validate channelId
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid Channel Id.");
  }

  // Validate & sanitize limit
  limit = parseInt(limit);

  if (isNaN(limit)) {
    limit = 30;
  }

  limit = Math.min(Math.max(limit, 1), 100);

  // Sort order
  const sortOrder = sortType === "asc" ? 1 : -1;

  // Allowed sort fields
  const allowedFields = ["_id", "title", "duration", "createdAt"];

  if (!allowedFields.includes(sortBy)) {
    sortBy = "_id";
  }

  // Parse lastId safely
  let parsedLastId = null;

  if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
    parsedLastId = new mongoose.Types.ObjectId(lastId);
  }

  // Convert lastValue according to sort field
  if (sortBy === "_id") {
    lastValue = parsedLastId;
  }

  if (sortBy === "duration" && lastValue !== undefined) {
    lastValue = Number(lastValue);

    if (isNaN(lastValue)) {
      throw new ApiError(400, "Invalid duration cursor.");
    }
  }

  if (sortBy === "createdAt" && lastValue) {
    lastValue = new Date(lastValue);

    if (isNaN(lastValue.getTime())) {
      throw new ApiError(400, "Invalid createdAt cursor.");
    }
  }

  // Base query
  const query = {};
  query.isPublished = true

  // Owner / published filtering
  if (req.user?._id?.equals(channelId)) {
    query.owner = req.user._id;
  } else {
    query.owner = channelId;
    query.isPublished = true;
  }

  // Cursor pagination query
  if (sortBy === "_id") {
    if (parsedLastId) {
      query._id =
        sortOrder === 1
          ? { $gt: parsedLastId }
          : { $lt: parsedLastId };
    }
  } else {
    if (
      lastValue !== undefined &&
      lastValue !== null &&
      parsedLastId
    ) {
      query.$or = [
        {
          [sortBy]:
            sortOrder === 1
              ? { $gt: lastValue }
              : { $lt: lastValue }
        },
        {
          [sortBy]: lastValue,
          _id:
            sortOrder === 1
              ? { $gt: parsedLastId }
              : { $lt: parsedLastId }
        }
      ];
    }
  }

  // Fetch videos
  const videos = await Video.find(query)
    .sort({
      [sortBy]: sortOrder,
      _id: sortOrder
    })
    .limit(limit);

  // Generate next cursor
  let nextCursor = null;

  if (videos.length === limit) {
    const lastItem = videos[videos.length - 1];

    nextCursor = {
      lastValue: lastItem[sortBy],
      lastId: lastItem._id
    };
  }

  // Response
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


const searchVideos = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    throw new ApiError(400, "Search query is required.");
  }

  const query = q.trim();

  // Fetch all published videos with owner info
  const videos = await Video.aggregate([
    { $match: { isPublished: true } },
    {
      $lookup: {
        from: "users",
        let: { ownerId: "$owner" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$ownerId"] } } },
          { $project: { avatar: 1, username: 1, fullName: 1 } }
        ],
        as: "owner"
      }
    },
    { $unwind: "$owner" }
  ]);

  // Score each video
  const scored = videos.map((video) => {
    const titleLower = (video.title || "").toLowerCase();
    const descLower = (video.description || "").toLowerCase();

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    let score = 0;

    // Exact phrase match
    if (titleLower.includes(query.toLowerCase())) score += 100;
    if (descLower.includes(query.toLowerCase())) score += 40;

    // Individual word matches
    for (const word of words) {
      if (titleLower.includes(word)) score += 10;
      if (descLower.includes(word)) score += 3;

      // Bonus for title/description STARTING with the search word
      if (titleLower.startsWith(word)) score += 50;
      if (descLower.startsWith(word)) score += 15;

      // Bonus if any word in the title starts with search term
      const titleWords = titleLower.split(/\s+/);
      if (titleWords.some(w => w.startsWith(word))) score += 20;
    }
    return { ...video, _searchScore: score };
  });

  // Only return videos with at least one match, sorted by score
  const results = scored
    .filter((v) => v._searchScore > 0)
    .sort((a, b) => b._searchScore - a._searchScore);

  return res.status(200).json(
    new ApiResponse(200, { videos: results }, `${results.length} results found.`)
  );
});

export {
  publishAVideo,
  getAllVideos,
  updateVideoDetails,
  togglePublishStatus,
  deleteVideo,
  getVideoById,
  recordVideoView,
  getChannelVideos,
  searchVideos
}