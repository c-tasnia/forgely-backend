import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { parseRepoUrl, getRepoActivity } from "../services/github.js";

export const getProjectGithubActivity = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(project, req.user.id);
    if (!role) return res.status(403).json({ message: "You are not a member of this project" });

    if (!project.githubRepo) {
      return res.status(400).json({ message: "No GitHub repository linked to this project" });
    }

    const parsed = parseRepoUrl(project.githubRepo);
    if (!parsed) {
      return res.status(400).json({ message: "Couldn't parse a GitHub owner/repo from the saved URL" });
    }

    const activity = await getRepoActivity(parsed.owner, parsed.repo);
    res.json(activity);
  } catch (err) {
    next(err);
  }
};
