import express from "express";
import { getMessages } from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:projectId/messages", protect, getMessages);

export default router;
