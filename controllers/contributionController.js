import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { parseRepoUrl, getRepoActivity, getUserMergedPRCount, getUserReviewCount } from "../services/github.js";

// Weights match the original spec: tasks 40 / commits 25 / PRs 20 / reviews 10 / activity 5
const WEIGHTS = { tasks: 0.4, commits: 0.25, prs: 0.2, reviews: 0.1, activity: 0.05 };

const normalize = (value, max) => (max > 0 ? Math.round((value / max) * 100) : 0);

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

    const maxTasks = Math.max(0, ...raw.map((r) => r.tasksCompleted));
    const maxActivity = Math.max(0, ...raw.map((r) => r.activityTouches));
    const maxCommits = Math.max(0, ...raw.map((r) => r.commits));
    const maxPrs = Math.max(0, ...raw.map((r) => r.prs));
    const maxReviews = Math.max(0, ...raw.map((r) => r.reviews));

    const members = raw
      .map((r) => {
        const breakdown = {
          tasks: normalize(r.tasksCompleted, maxTasks),
          commits: normalize(r.commits, maxCommits),
          prs: normalize(r.prs, maxPrs),
          reviews: normalize(r.reviews, maxReviews),
          activity: normalize(r.activityTouches, maxActivity),
        };
        const score = Math.round(
          breakdown.tasks * WEIGHTS.tasks +
            breakdown.commits * WEIGHTS.commits +
            breakdown.prs * WEIGHTS.prs +
            breakdown.reviews * WEIGHTS.reviews +
            breakdown.activity * WEIGHTS.activity
        );
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
