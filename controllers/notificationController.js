import prisma from "../config/prisma.js";

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user.id) {
      return res.status(404).json({ message: "Notification not found" });
    }
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json({ notification: updated });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};
