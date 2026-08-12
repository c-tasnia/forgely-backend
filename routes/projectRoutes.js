import express from "express";
import {
  createProject,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
  removeMember,
} from "../controllers/projectController.js";
import { createInvite } from "../controllers/inviteController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createProject).get(getMyProjects);
router.route("/:id").get(getProjectById).patch(updateProject).delete(deleteProject);
router.delete("/:id/members/:userId", removeMember);
router.post("/:projectId/invites", createInvite);

export default router;
