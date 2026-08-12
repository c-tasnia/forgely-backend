import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { toSafeUser } from "../utils/serialize.js";

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const register = async (req, res, next) => {
  try {
    const { name, email, password, skills, bio, profilePicture } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashed,
        skills: skills || [],
        bio: bio || "",
        profilePicture: profilePicture || "",
      },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: toSafeUser(user) });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (user.banned) {
      return res.status(403).json({ message: "This account has been suspended. Contact support." });
    }

    const token = signToken(user.id);
    res.json({ token, user: toSafeUser(user) });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res) => {
  res.json({ user: toSafeUser(req.user) });
};

export const updateMe = async (req, res, next) => {
  try {
    const allowed = ["name", "bio", "skills", "profilePicture", "githubUsername"];
    const data = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    next(err);
  }
};
