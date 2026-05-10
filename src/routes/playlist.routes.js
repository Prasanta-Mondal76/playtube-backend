import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createPlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  updatePlaylist,
  deletePlaylist,
  getUserPlaylists,
  getPlaylistById,

} from "../controller/playlist.controller.js"

const router = Router()

// Run middleware for every router. 
router.use(verifyJWT)

router.route("/create-playlist").post( createPlaylist)
router.route("/add-video/:playlistId/video/:videoId").post( addVideoToPlaylist)
router.route("/remove-video/:playlistId/video/:videoId").delete( removeVideoFromPlaylist)
router.route("/update-video/:playlistId").patch( updatePlaylist)
router.route("/delete-video/:playlistId").delete( deletePlaylist)
router.route("/get-playlists/:userId").get( getUserPlaylists)
router.route("/get-playlist/:playlistId").get( getPlaylistById)


export default router