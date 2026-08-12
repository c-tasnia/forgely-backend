import express from "express";
import { getProjectGithubActivity } from "../controllers/githubController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:projectId/github", protect, getProjectGithubActivity);

export default router;
