import express from "express";
import {
  createTask,
  getProjectTasks,
  updateTask,
  moveTask,
  deleteTask,
} from "../controllers/taskController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/project/:projectId").post(createTask).get(getProjectTasks);
router.route("/:id").patch(updateTask).delete(deleteTask);
router.patch("/:id/move", moveTask);

export default router;
