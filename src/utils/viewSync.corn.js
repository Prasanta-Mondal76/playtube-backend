import redisClient from "../db/redis.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"

const syncViewsToMongoDB = async () => {

  try {

    // Get all changed videos
    const dirtyVideos = await redisClient.sMembers("dirty:videos")

    // If nothing changed
    if (!dirtyVideos.length) {
      return
    }

    for (const videoId of dirtyVideos) {

      // Get latest Redis views
      const views = Number(
        await redisClient.get(`video:${videoId}:views`)
      ) || 0

      // Update MongoDB Video Model
      const oldVid = await Video.findByIdAndUpdate(
        videoId,
        {
          $set: { views }
        },
        {
          returnDocument: 'before'
        }
      )

      // Update MongoDB User Model
      const delta = Math.max(views - oldVid.views, 0)
      await User.findByIdAndUpdate(
        oldVid.owner,
        {
          $inc: {
            totalViews: delta
          }
        }
      )
      // Remove dirty flag
      await redisClient.sRem("dirty:videos", videoId)
    }

  } catch (error) {

    console.log("Views Sync Error:", error.message)
  }
}

export default syncViewsToMongoDB