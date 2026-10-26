import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getUploadSignature } from "../controller/upload.controller.js";

const router = Router();

// Only a logged-in user can get an upload signature.
router.route("/signature").get(verifyJWT, getUploadSignature);

export default router;
