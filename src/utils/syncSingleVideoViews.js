import redisClient from "../db/redis.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"

export const syncAVideoViewsToMongoDB = async (videoId) => {

  try {
    const isDirty = await redisClient.sIsMember("dirty:videos", videoId)

    // If nothing changed
    if (!isDirty) return;

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

    if (!oldVid) {
      await redisClient.sRem("dirty:videos", videoId)
      return
    }
    // Update MongoDB User Model
    const delta = Math.max(views - oldVid.views, 0)
    if(delta > 0 ){
      await User.findByIdAndUpdate(
        oldVid.owner,
        {
          $inc: {
            totalViews: delta
          }
        }
      )
    }
    // Remove dirty flag
    await redisClient.sRem("dirty:videos", videoId)

  } catch (error) {
    console.log("Views Sync Error:", error.message)
  }
}
