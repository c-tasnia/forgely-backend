import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { parseRepoUrl, getRepoActivity, getUserMergedPRCount, getUserReviewCount } from "../services/github.js";
import { WEIGHTS, buildBreakdown, computeScore, maxOf } from "../utils/scoring.js";

export const getProjectContribution = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: { include: { user: true } } },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = userProjectRole(project, req.user.id);
    if (!role) return res.status(403).json({ message: "You are not a member of this project" });

    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });

    const parsed = parseRepoUrl(project.githubRepo);
    let repoActivity = null;
    if (parsed) {
      try {
        repoActivity = await getRepoActivity(parsed.owner, parsed.repo);
      } catch {
        repoActivity = null; // fall back to GitHub-less scoring rather than failing the whole panel
      }
    }

    const contributorsByLogin = new Map(
      (repoActivity?.contributors || []).map((c) => [c.login.toLowerCase(), c])
    );

    const raw = await Promise.all(
      project.members.map(async (m) => {
        const tasksAssigned = tasks.filter((t) => t.assignedToId === m.userId);
        const tasksCompleted = tasksAssigned.filter((t) => t.status === "done").length;
        const activityTouches = tasks.filter(
          (t) => t.createdById === m.userId || t.assignedToId === m.userId
        ).length;

        let commits = 0;
        let prs = 0;
        let reviews = 0;

        const ghUsername = m.user.githubUsername;
        if (parsed && ghUsername) {
          const contributor = contributorsByLogin.get(ghUsername.toLowerCase());
          commits = contributor?.contributions || 0;
          try {
            [prs, reviews] = await Promise.all([
              getUserMergedPRCount(parsed.owner, parsed.repo, ghUsername),
              getUserReviewCount(parsed.owner, parsed.repo, ghUsername),
            ]);
          } catch {
            prs = 0;
            reviews = 0;
          }
        }

        return { member: m, tasksCompleted, activityTouches, commits, prs, reviews };
      })
    );

    const maxes = {
      tasks: maxOf(raw.map((r) => r.tasksCompleted)),
      activity: maxOf(raw.map((r) => r.activityTouches)),
      commits: maxOf(raw.map((r) => r.commits)),
      prs: maxOf(raw.map((r) => r.prs)),
      reviews: maxOf(raw.map((r) => r.reviews)),
    };

    const members = raw
      .map((r) => {
        const breakdown = buildBreakdown(r, maxes);
        const score = computeScore(breakdown);
        return {
          userId: r.member.userId,
          name: r.member.user.name,
          role: r.member.role,
          score,
          breakdown,
          raw: { tasksCompleted: r.tasksCompleted, commits: r.commits, prs: r.prs, reviews: r.reviews },
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({ members, githubConnected: Boolean(parsed), weights: WEIGHTS });
  } catch (err) {
    next(err);
  }
};
