import redisClient from "../db/redis.js"
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

      // Update MongoDB
      await Video.findByIdAndUpdate(
        videoId,
        {
          $set: { views }
        }
      )

      // Remove dirty flag
      await redisClient.sRem("dirty:videos", videoId)
    }

    console.log("Views synced successfully")

  } catch (error) {

    console.log("Views Sync Error:", error.message)
  }
}

export default syncViewsToMongoDB