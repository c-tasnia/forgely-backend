import express from "express";
import { getMyInvites, respondToInvite } from "../controllers/inviteController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyInvites);
router.patch("/:id/respond", respondToInvite);

export default router;
