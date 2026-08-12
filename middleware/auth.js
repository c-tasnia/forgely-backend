import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { toSafeUser } from "../utils/serialize.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    if (user.banned) return res.status(403).json({ message: "This account has been suspended. Contact support." });
    req.user = user; // full row, including password hash — never send this straight back to the client
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Determines the requesting user's role within a project, given its `members` relation included.
export const userProjectRole = (project, userId) => {
  if (project.ownerId === userId) return "owner";
  const member = project.members.find((m) => m.userId === userId);
  return member ? member.role : null;
};

export { toSafeUser };
