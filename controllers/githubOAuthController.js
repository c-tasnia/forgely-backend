import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

// state carries the Forgely user's id through GitHub's redirect, signed so it
// can't be tampered with — GitHub just echoes it back unchanged on the callback.
const signState = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10m" });

export const getConnectUrl = async (req, res, next) => {
  try {
    if (!process.env.GITHUB_OAUTH_CLIENT_ID) {
      return res.status(503).json({ message: "GitHub OAuth isn't configured on this server" });
    }
    const state = signState(req.user.id);
    const redirectUri = `${process.env.SERVER_URL}/api/auth/github/callback`;
    const url = `${GITHUB_AUTHORIZE_URL}?client_id=${process.env.GITHUB_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=`;
    res.json({ url });
  } catch (err) {
    next(err);
  }
};

export const githubCallback = async (req, res) => {
  const redirectWithStatus = (status) => res.redirect(`${process.env.CLIENT_URL}/dashboard/profile?github=${status}`);

  try {
    const { code, state } = req.query;
    if (!code || !state) return redirectWithStatus("error");

    let userId;
    try {
      ({ userId } = jwt.verify(state, process.env.JWT_SECRET));
    } catch {
      return redirectWithStatus("error");
    }

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.SERVER_URL}/api/auth/github/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return redirectWithStatus("error");

    const profileRes = await fetch(GITHUB_USER_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
    });
    const profile = await profileRes.json();
    if (!profile.login) return redirectWithStatus("error");

    await prisma.user.update({
      where: { id: userId },
      data: { githubUsername: profile.login, githubConnected: true },
    });

    redirectWithStatus("connected");
  } catch (err) {
    redirectWithStatus("error");
  }
};

export const disconnectGithub = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { githubUsername: "", githubConnected: false },
    });
    res.json({ message: "GitHub disconnected" });
  } catch (err) {
    next(err);
  }
};
