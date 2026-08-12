import prisma from "../config/prisma.js";

// Set by server.js once the Socket.IO server is created, so this service can push
// live notifications without controllers needing to know about sockets directly.
let ioInstance = null;
export const setSocketServer = (io) => { ioInstance = io; };

export const notify = async ({ userId, type, title, body = "", link = "" }) => {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, link },
  });

  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit("notification:new", notification);
  }

  return notification;
};
