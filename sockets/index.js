import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { setSocketServer } from "../services/notify.js";

// projectId -> Set of userIds currently viewing that project's chat (for presence + typing)
const projectPresence = new Map();

const broadcastPresence = (io, projectId) => {
  const online = Array.from(projectPresence.get(projectId) || []);
  io.to(`project:${projectId}`).emit("presence:update", { projectId, online });
};

export const initSocket = (httpServer, clientUrl) => {
  const io = new Server(httpServer, {
    cors: { origin: clientUrl || "*", credentials: true },
  });

  // Auth handshake: client connects with { auth: { token } }
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || user.banned) return next(new Error("Not authorized"));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    // Personal room for direct notification delivery
    socket.join(`user:${socket.user.id}`);

    socket.on("project:join", async ({ projectId }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
      if (!project || !userProjectRole(project, socket.user.id)) return; // silently ignore — not a member

      socket.join(`project:${projectId}`);
      socket.data.projectId = projectId;

      if (!projectPresence.has(projectId)) projectPresence.set(projectId, new Set());
      projectPresence.get(projectId).add(socket.user.id);
      broadcastPresence(io, projectId);
    });

    socket.on("project:leave", ({ projectId }) => {
      socket.leave(`project:${projectId}`);
      projectPresence.get(projectId)?.delete(socket.user.id);
      broadcastPresence(io, projectId);
    });

    socket.on("chat:message", async ({ projectId, content }) => {
      if (!content?.trim() || !projectId) return;

      const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: { include: { user: true } } } });
      if (!project || !userProjectRole(project, socket.user.id)) return;

      const message = await prisma.message.create({
        data: { projectId, senderId: socket.user.id, content: content.trim().slice(0, 2000) },
        include: { sender: true },
      });

      const payload = {
        id: message.id,
        projectId,
        content: message.content,
        createdAt: message.createdAt,
        sender: { id: message.sender.id, name: message.sender.name, profilePicture: message.sender.profilePicture },
      };
      io.to(`project:${projectId}`).emit("chat:message", payload);

      // @mentions — match against each member's name (case-insensitive, first name is enough to keep it simple)
      const mentioned = project.members.filter((m) => {
        const firstName = m.user.name.split(" ")[0];
        return m.userId !== socket.user.id && content.toLowerCase().includes(`@${firstName.toLowerCase()}`);
      });
      for (const m of mentioned) {
        const notification = await prisma.notification.create({
          data: {
            userId: m.userId,
            type: "mention",
            title: `${socket.user.name} mentioned you in ${project.name}`,
            body: message.content.slice(0, 120),
            link: `/dashboard/projects/${projectId}`,
          },
        });
        io.to(`user:${m.userId}`).emit("notification:new", notification);
      }
    });

    socket.on("chat:typing", ({ projectId }) => {
      if (!projectId) return;
      socket.to(`project:${projectId}`).emit("chat:typing", { userId: socket.user.id, name: socket.user.name });
    });

    socket.on("disconnect", () => {
      const projectId = socket.data.projectId;
      if (projectId) {
        projectPresence.get(projectId)?.delete(socket.user.id);
        broadcastPresence(io, projectId);
      }
    });
  });

  setSocketServer(io);
  return io;
};
