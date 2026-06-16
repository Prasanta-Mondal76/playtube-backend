import redisClient from "../db/redis.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"
import mongoose from "mongoose"

export const syncLikesToMongoDB = async () => {
  try {

    // Get affected users
    const dirtyUsers = await redisClient.sMembers("dirty:users")

    if (!dirtyUsers.length) {
      return
    }

    for (const userId of dirtyUsers) {

      // Calculate total likes
      const result = await Video.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $group: {
            _id: null,
            totalLikes: {
              $sum: "$likes"
            }
          }
        }
      ])

      const totalLikes = result[0]?.totalLikes || 0

      // Update user
      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            totalVideoLikes: totalLikes
          }
        }
      )

      // Remove dirty flag
      await redisClient.sRem("dirty:users", userId)
    }

  } catch (error) {

    console.log("Likes Sync Error:", error.message)
  }
}