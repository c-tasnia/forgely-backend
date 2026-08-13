import express from "express";
import { authorizeChannel } from "../controllers/pusherAuthController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/auth", protect, authorizeChannel);

export default router;
