import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { stripPasswords } from "../utils/serialize.js";
import { notify } from "../services/notify.js";

const canEditProject = (role) => role === "owner" || role === "developer";

const getProjectWithMembers = (id) =>
  prisma.project.findUnique({ where: { id }, include: { members: true } });

export const createTask = async (req, res, next) => {
  try {
    const { title, description, assignedTo, priority, deadline, status, checklist } = req.body;
    const project = await getProjectWithMembers(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(project, req.user.id);
    if (!canEditProject(role)) return res.status(403).json({ message: "Viewers cannot create tasks" });
    if (!title) return res.status(400).json({ message: "Task title is required" });

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title,
        description: description || "",
        assignedToId: assignedTo || null,
        priority: priority || "medium",
        deadline: deadline ? new Date(deadline) : null,
        status: status || "todo",
        checklist: checklist || [],
        createdById: req.user.id,
      },
      include: { assignedTo: true },
    });

    if (task.assignedToId && task.assignedToId !== req.user.id) {
      notify({
        userId: task.assignedToId,
        type: "task_assigned",
        title: `${req.user.name} assigned you "${task.title}"`,
        body: project.name,
        link: `/dashboard/projects/${project.id}`,
      }).catch(() => {}); // best-effort — a notification failure shouldn't fail the task creation
    }

    res.status(201).json({ task: stripPasswords(task) });
  } catch (err) {
    next(err);
  }
};

export const getProjectTasks = async (req, res, next) => {
  try {
    const project = await getProjectWithMembers(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(project, req.user.id);
    if (!role) return res.status(403).json({ message: "You are not a member of this project" });

    const tasks = await prisma.task.findMany({
      where: { projectId: project.id },
      include: { assignedTo: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ tasks: stripPasswords(tasks) });
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await getProjectWithMembers(task.projectId);
    const role = userProjectRole(project, req.user.id);
    if (!canEditProject(role)) return res.status(403).json({ message: "Viewers cannot update tasks" });

    const allowed = ["title", "description", "assignedTo", "priority", "deadline", "status", "checklist"];
    const data = {};
    allowed.forEach((field) => {
      if (req.body[field] === undefined) return;
      if (field === "assignedTo") data.assignedToId = req.body.assignedTo || null;
      else if (field === "deadline") data.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      else data[field] = req.body[field];
    });

    const updated = await prisma.task.update({ where: { id: req.params.id }, data, include: { assignedTo: true } });

    if (data.assignedToId && data.assignedToId !== task.assignedToId && data.assignedToId !== req.user.id) {
      notify({
        userId: data.assignedToId,
        type: "task_assigned",
        title: `${req.user.name} assigned you "${updated.title}"`,
        body: project.name,
        link: `/dashboard/projects/${project.id}`,
      }).catch(() => {});
    }

    res.json({ task: stripPasswords(updated) });
  } catch (err) {
    next(err);
  }
};

// Dedicated endpoint for drag-and-drop column moves
export const moveTask = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["todo", "in_progress", "review", "done"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await getProjectWithMembers(task.projectId);
    const role = userProjectRole(project, req.user.id);
    if (!canEditProject(role)) return res.status(403).json({ message: "Viewers cannot move tasks" });

    const updated = await prisma.task.update({ where: { id: req.params.id }, data: { status } });
    res.json({ task: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await getProjectWithMembers(task.projectId);
    const role = userProjectRole(project, req.user.id);
    if (!canEditProject(role)) return res.status(403).json({ message: "Viewers cannot delete tasks" });

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: "Task deleted" });
  } catch (err) {
    next(err);
  }
};
