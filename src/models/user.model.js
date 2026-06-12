import mongoose from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  avatar: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
  },
  password: {
    type: String,
    required: [true, "password is required"]
  },
  watchHistoryPaused:{
    type: Boolean, 
    default: false
  },
  about:{
    type: String, 
    default: "",
    trim: true
  },
  refreshToken: {
    type: String,
  },

  totalSubscribers: {
    type: Number,
    default: 0
  },

  totalSubscribedChannels: {
    type: Number,
    default: 0
  },

  totalVideos: {
    type: Number,
    default: 0
  },

  totalPublishedVideos: {
    type: Number,
    default: 0
  },

  totalViews: {
    type: Number,
    default: 0
  },

  totalVideoLikes: {
    type: Number,
    default: 0
  }

}, { timestamps: true })

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
})

userSchema.methods.isPasswordCorrect = async function (pass) {
  return await bcrypt.compare(pass, this.password)
}

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  )
}

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  )
}

export const User = mongoose.model("User", userSchema)