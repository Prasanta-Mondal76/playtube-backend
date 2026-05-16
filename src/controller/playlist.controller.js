import { ApiError, ApiResponse, asyncHandler } from "../utils/index.js"
import { Playlist } from "../models/playlist.model.js"
import mongoose from "mongoose"

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body

  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!name?.trim()) throw new ApiError(400, "Playlist Name is required.")

  const playlist = await Playlist.create({
    name,
    description: description?.trim() || "",
    owner: req.user._id
  })

  return res.status(201).json(new ApiResponse(201, playlist, "Playlist created."))
})


const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params

  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!mongoose.Types.ObjectId.isValid(playlistId)) throw new ApiError(400, "Invalid playlist id.")
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ApiError(400, "Invalid Video id.")

  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user._id
    },
    {
      // Add unique IDs. 
      $addToSet: {
        videos: videoId
      }
    },
    {
      returnDocument: "after"
    }
  )

  if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, playlist, "Video added successfully."))
})


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params
  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!mongoose.Types.ObjectId.isValid(playlistId)) throw new ApiError(400, "Invalid playlist id.")
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ApiError(400, "Invalid Video id.")

  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user._id
    },
    {
      // Removed all matched IDs
      $pull: {
        videos: videoId
      }
    },
    {
      returnDocument: "after"
    }
  )

  if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, playlist, "Video removed from playlist successfully."))
})


const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params
  const { name, description } = req.body
  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!mongoose.Types.ObjectId.isValid(playlistId)) throw new ApiError(400, "Invalid playlist id.")

  const updateDetails = {}
  if (name?.trim()) updateDetails.name = name.trim()
  if (description?.trim()) updateDetails.description = description.trim()
  if (Object.keys(updateDetails).length === 0) {
    throw new ApiError(400, "At least one field (name or description) is required to update.")
  }
  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user._id
    },
    {
      $set: updateDetails
    },
    {
      returnDocument: "after",
      runValidators: true
    }
  )

  if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, playlist, "Playlist details updated successfully."))
})


const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params
  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!mongoose.Types.ObjectId.isValid(playlistId)) throw new ApiError(400, "Invalid playlist id.")

  const playlist = await Playlist.findOneAndDelete(
    {
      _id: playlistId,
      owner: req.user._id
    }
  )
  if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, playlist, "Playlist deleted successfully."))
})


const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params
  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new ApiError(400, "Invalid user id.")
  if(!req.user._id.equals(userId)) throw new ApiError(403, "Forbidden");

  const playlists = await Playlist.find(
    {
      owner: userId
    }
  )
  if (playlists.length === 0) throw new ApiError(404, "No playlist found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, playlists, "Playlists successfully."))
})


const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params
  if (!req.user?._id) throw new ApiError(401, "Unauthorized")
  if (!mongoose.Types.ObjectId.isValid(playlistId)) throw new ApiError(400, "Invalid playlist id.")

  const playlist = await Playlist.findOne(
    {
      _id: playlistId,
      owner: req.user._id
    }
  )
  if (!playlist) throw new ApiError(404, "Playlist not found or unauthorized.")

  return res.status(200).json(new ApiResponse(200, playlist, "Playlist found successfully."))
})


export {
  createPlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  updatePlaylist,
  deletePlaylist,
  getUserPlaylists,
  getPlaylistById
}