import express from "express";
import { register, login, getMe, updateMe } from "../controllers/authController.js";
import { getConnectUrl, githubCallback, disconnectGithub } from "../controllers/githubOAuthController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);

router.get("/github/connect", protect, getConnectUrl);
router.get("/github/callback", githubCallback); // no protect — GitHub calls this directly, identity comes from the signed state param
router.delete("/github", protect, disconnectGithub);

export default router;
