import express from "express";
import multer from "multer";
import { uploadFile, getFiles, deleteFile } from "../controllers/fileController.js";
import { protect } from "../middleware/auth.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

router.use(protect);

router.route("/:projectId/files").post(upload.single("file"), uploadFile).get(getFiles);
router.delete("/:projectId/files/:id", deleteFile);

export default router;
