import prisma from "../config/prisma.js";
import pusher from "../config/pusher.js";

export const notify = async ({ userId, type, title, body = "", link = "" }) => {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, link },
  });

  if (process.env.PUSHER_APP_ID) {
    pusher.trigger(`private-user-${userId}`, "notification:new", notification).catch(() => {});
  }

  return notification;
};
