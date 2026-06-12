import mongoose from "mongoose";

const watchHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },

    watchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);


// Prevent duplicate history entries
watchHistorySchema.index(
  { user: 1, video: 1 },
  { unique: true }
);


// Fast querying for history
watchHistorySchema.index({
  user: 1,
  watchedAt: -1,
});


// Auto delete after 60 days
watchHistorySchema.index(
  { watchedAt: 1 },
  {
    expireAfterSeconds:
      60 * 60 * 24 * 60,
  }
);

export const WatchHistory = mongoose.model("WatchHistory", watchHistorySchema);