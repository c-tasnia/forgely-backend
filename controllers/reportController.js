import prisma from "../config/prisma.js";

export const createReport = async (req, res, next) => {
  try {
    const { targetType, targetId, reason } = req.body;
    if (!["user", "project"].includes(targetType) || !targetId || !reason) {
      return res.status(400).json({ message: "targetType, targetId and reason are required" });
    }
    const report = await prisma.report.create({
      data: { reportedById: req.user.id, targetType, targetId, reason },
    });
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
};
