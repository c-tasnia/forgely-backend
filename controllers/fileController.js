import prisma from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import { userProjectRole } from "../middleware/auth.js";
import { stripPasswords } from "../utils/serialize.js";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    if (req.file.size > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: "File exceeds the 10MB limit" });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });
    const role = userProjectRole(project, req.user.id);
    if (!role || role === "viewer") {
      return res.status(403).json({ message: "Viewers cannot upload files" });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({ message: "File storage isn't configured — set CLOUDINARY_* env vars on the backend" });
    }

    const result = await uploadBuffer(req.file.buffer, {
      folder: `projectforge/${project.id}`,
      resource_type: "auto",
      public_id: req.file.originalname.replace(/\.[^/.]+$/, "").slice(0, 80),
    });

    const file = await prisma.projectFile.create({
      data: {
        projectId: project.id,
        uploadedById: req.user.id,
        name: req.file.originalname,
        url: result.secure_url,
        publicId: result.public_id,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
      include: { uploadedBy: true },
    });

    res.status(201).json({ file: stripPasswords(file) });
  } catch (err) {
    next(err);
  }
};

export const getFiles = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!userProjectRole(project, req.user.id)) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    const files = await prisma.projectFile.findMany({
      where: { projectId: project.id },
      include: { uploadedBy: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ files: stripPasswords(files) });
  } catch (err) {
    next(err);
  }
};

export const deleteFile = async (req, res, next) => {
  try {
    const file = await prisma.projectFile.findUnique({ where: { id: req.params.id } });
    if (!file) return res.status(404).json({ message: "File not found" });

    const project = await prisma.project.findUnique({ where: { id: file.projectId }, include: { members: true } });
    const role = userProjectRole(project, req.user.id);
    const canDelete = role === "owner" || file.uploadedById === req.user.id;
    if (!canDelete) return res.status(403).json({ message: "Only the uploader or project owner can delete this file" });

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      await cloudinary.uploader.destroy(file.publicId, { resource_type: "auto" }).catch(() => {});
    }
    await prisma.projectFile.delete({ where: { id: file.id } });
    res.json({ message: "File deleted" });
  } catch (err) {
    next(err);
  }
};
