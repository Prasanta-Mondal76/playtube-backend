import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  getBlockStatus,
} from "../controller/block.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getBlockedUsers);           // GET  /api/v1/blocks
router.route("/:userId").post(blockUser);          // POST /api/v1/blocks/:userId
router.route("/:userId").delete(unblockUser);      // DELETE /api/v1/blocks/:userId
router.route("/:userId/status").get(getBlockStatus); // GET /api/v1/blocks/:userId/status

export default router;