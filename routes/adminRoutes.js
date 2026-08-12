import express from "express";
import {
  getUsers,
  banUser,
  unbanUser,
  deleteUser,
  getProjects,
  deleteProject,
  archiveProject,
  getStats,
  getReports,
  resolveReport,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/stats", getStats);

router.get("/users", getUsers);
router.patch("/users/:id/ban", banUser);
router.patch("/users/:id/unban", unbanUser);
router.delete("/users/:id", deleteUser);

router.get("/projects", getProjects);
router.delete("/projects/:id", deleteProject);
router.patch("/projects/:id/archive", archiveProject);

router.get("/reports", getReports);
router.patch("/reports/:id/resolve", resolveReport);

export default router;
