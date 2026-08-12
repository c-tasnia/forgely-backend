import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { stripPasswords } from "../utils/serialize.js";

const memberInclude = { members: { include: { user: true } }, owner: true };

export const createProject = async (req, res, next) => {
  try {
    const { name, description, techStack, projectType, deadline, githubRepo } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "Project name and description are required" });
    }
    const project = await prisma.project.create({
      data: {
        name,
        description,
        techStack: techStack || [],
        projectType: projectType || "",
        deadline: deadline ? new Date(deadline) : null,
        githubRepo: githubRepo || "",
        ownerId: req.user.id,
        members: { create: [{ userId: req.user.id, role: "owner", label: "Owner" }] },
      },
      include: memberInclude,
    });
    res.status(201).json({ project: stripPasswords(project) });
  } catch (err) {
    next(err);
  }
};

export const getMyProjects = async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: memberInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ projects: stripPasswords(projects) });
  } catch (err) {
    next(err);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: memberInclude,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(project, req.user.id);
    if (!role) return res.status(403).json({ message: "You are not a member of this project" });

    res.json({ project: stripPasswords(project), role });
  } catch (err) {
    next(err);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id }, include: memberInclude });
    if (!existing) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(existing, req.user.id);
    if (role !== "owner") return res.status(403).json({ message: "Only the owner can update the project" });

    const allowed = ["name", "description", "techStack", "projectType", "deadline", "githubRepo", "status"];
    const data = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        data[field] = field === "deadline" && req.body[field] ? new Date(req.body[field]) : req.body[field];
      }
    });

    const project = await prisma.project.update({ where: { id: req.params.id }, data, include: memberInclude });
    res.json({ project: stripPasswords(project) });
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id }, include: memberInclude });
    if (!existing) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(existing, req.user.id);
    if (role !== "owner") return res.status(403).json({ message: "Only the owner can delete the project" });

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: "Project deleted" });
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id }, include: memberInclude });
    if (!existing) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(existing, req.user.id);
    if (role !== "owner") return res.status(403).json({ message: "Only the owner can remove members" });

    await prisma.projectMember.deleteMany({ where: { projectId: req.params.id, userId: req.params.userId } });
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: memberInclude });
    res.json({ project: stripPasswords(project) });
  } catch (err) {
    next(err);
  }
};
