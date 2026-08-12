import express from "express";
import { getProjectContribution } from "../controllers/contributionController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:projectId/contribution", protect, getProjectContribution);

export default router;
