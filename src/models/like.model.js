import mongoose, { Types } from "mongoose";

const likeSchema = new mongoose.Schema({
  comment:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment"
  },

  video:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Video"
  },
  
  
  likedBy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
}, { timestamps: true});


// Checking there is only one field
likeSchema.pre("validate", function () {
  const targets = [this.video, this.comment].filter(Boolean)
  if (targets.length !== 1) {
    throw new Error("Like must belong to exactly one: video or comment")
  }
})


// ✅ Unique per video like
likeSchema.index(
  { video: 1, likedBy: 1 },
  { unique: true, partialFilterExpression: { video: { $exists: true } } }
)

// ✅ Unique per comment like
likeSchema.index(
  { comment: 1, likedBy: 1 },
  { unique: true, partialFilterExpression: { comment: { $exists: true } } }
)


export const Like = mongoose.model("Like", likeSchema)