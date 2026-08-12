import prisma from "../config/prisma.js";
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
