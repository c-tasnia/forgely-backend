import prisma from "../config/prisma.js";
import pusher from "../config/pusher.js";
import { userProjectRole } from "../middleware/auth.js";
import { stripPasswords } from "../utils/serialize.js";

export const getMessages = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!userProjectRole(project, req.user.id)) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    const messages = await prisma.message.findMany({
      where: { projectId: project.id },
      include: { sender: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ messages: stripPasswords(messages.reverse()) });
  } catch (err) {
    next(err);
  }
};

export const postMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Message content is required" });

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!userProjectRole(project, req.user.id)) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    const message = await prisma.message.create({
      data: { projectId: project.id, senderId: req.user.id, content: content.trim().slice(0, 2000) },
      include: { sender: true },
    });

    const payload = {
      id: message.id,
      projectId: project.id,
      content: message.content,
      createdAt: message.createdAt,
      sender: { id: message.sender.id, name: message.sender.name, profilePicture: message.sender.profilePicture },
    };

    if (process.env.PUSHER_APP_ID) {
      pusher.trigger(`presence-project-${project.id}`, "chat:message", payload).catch(() => {});
    }

    // @mentions — match against each member's first name, case-insensitive
    const mentioned = project.members.filter((m) => {
      const firstName = m.user.name.split(" ")[0];
      return m.userId !== req.user.id && content.toLowerCase().includes(`@${firstName.toLowerCase()}`);
    });
    for (const m of mentioned) {
      const notification = await prisma.notification.create({
        data: {
          userId: m.userId,
          type: "mention",
          title: `${req.user.name} mentioned you in ${project.name}`,
          body: message.content.slice(0, 120),
          link: `/dashboard/projects/${project.id}`,
        },
      });
      if (process.env.PUSHER_APP_ID) {
        pusher.trigger(`private-user-${m.userId}`, "notification:new", notification).catch(() => {});
      }
    }

    res.status(201).json({ message: payload });
  } catch (err) {
    next(err);
  }
};

export const postTyping = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!userProjectRole(project, req.user.id)) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    if (process.env.PUSHER_APP_ID) {
      pusher
        .trigger(`presence-project-${project.id}`, "chat:typing", { userId: req.user.id, name: req.user.name })
        .catch(() => {});
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
