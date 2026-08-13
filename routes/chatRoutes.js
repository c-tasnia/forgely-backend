import express from "express";
import { getMessages, postMessage, postTyping } from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:projectId/messages", protect, getMessages);
router.post("/:projectId/messages", protect, postMessage);
router.post("/:projectId/typing", protect, postTyping);

export default router;
