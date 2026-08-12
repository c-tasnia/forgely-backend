import prisma from "../config/prisma.js";
import { toAdminUser, stripPasswords } from "../utils/serialize.js";

const PAGE_SIZE = 50;

export const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = req.query.search || "";
    const where = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
      : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.user.count({ where }),
    ]);
    res.json({ users: users.map(toAdminUser), total, page, pages: Math.ceil(total / PAGE_SIZE) || 1 });
  } catch (err) {
    next(err);
  }
};

export const banUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Cannot ban an admin" });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: true, bannedReason: reason || "" },
    });
    res.json({ user: toAdminUser(updated) });
  } catch (err) {
    next(err);
  }
};

export const unbanUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: false, bannedReason: "" },
    });
    res.json({ user: toAdminUser(updated) });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Cannot delete an admin" });

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: "User deleted" });
  } catch (err) {
    next(err);
  }
};

export const getProjects = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = req.query.search || "";
    const where = search ? { name: { contains: search, mode: "insensitive" } } : {};
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { owner: true, members: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.project.count({ where }),
    ]);
    res.json({ projects: stripPasswords(projects), total, page, pages: Math.ceil(total / PAGE_SIZE) || 1 });
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: "Project not found" });

    await prisma.project.delete({ where: { id: req.params.id } }); // tasks/members cascade via schema
    res.json({ message: "Project deleted" });
  } catch (err) {
    next(err);
  }
};

export const archiveProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const updated = await prisma.project.update({ where: { id: req.params.id }, data: { status: "archived" } });
    res.json({ project: updated });
  } catch (err) {
    next(err);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const [totalUsers, totalProjects, activeProjects, openReports, totalTasks, newUsersThisWeek, newProjectsThisWeek] =
      await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.project.count({ where: { status: "active" } }),
        prisma.report.count({ where: { status: "open" } }),
        prisma.task.count(),
        prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.project.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      ]);

    res.json({ totalUsers, totalProjects, activeProjects, openReports, totalTasks, newUsersThisWeek, newProjectsThisWeek });
  } catch (err) {
    next(err);
  }
};

export const getReports = async (req, res, next) => {
  try {
    const status = req.query.status || "open";
    const reports = await prisma.report.findMany({
      where: { status },
      include: { reportedBy: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reports: stripPasswords(reports) });
  } catch (err) {
    next(err);
  }
};

export const resolveReport = async (req, res, next) => {
  try {
    const { action, note } = req.body; // action: "resolve" | "dismiss"
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    const updated = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        status: action === "dismiss" ? "dismissed" : "resolved",
        resolvedById: req.user.id,
        resolutionNote: note || "",
      },
    });
    res.json({ report: updated });
  } catch (err) {
    next(err);
  }
};
