// Weights match the original spec: tasks 40 / commits 25 / PRs 20 / reviews 10 / activity 5
export const WEIGHTS = { tasks: 0.4, commits: 0.25, prs: 0.2, reviews: 0.1, activity: 0.05 };

// Scales a raw count against the highest value in the group — the top contributor in
// each category lands at 100, everyone else scales relative to them. Returns 0 when
// nobody has any activity in that category (avoids dividing by zero).
export const normalize = (value, max) => (max > 0 ? Math.round((value / max) * 100) : 0);

// Builds the { tasks, commits, prs, reviews, activity } percentage breakdown for one
// member, given their raw counts and the group-wide maximums for each category.
export const buildBreakdown = (raw, maxes) => ({
  tasks: normalize(raw.tasksCompleted, maxes.tasks),
  commits: normalize(raw.commits, maxes.commits),
  prs: normalize(raw.prs, maxes.prs),
  reviews: normalize(raw.reviews, maxes.reviews),
  activity: normalize(raw.activityTouches, maxes.activity),
});

// Weighted sum of a breakdown, rounded to a whole percentage.
export const computeScore = (breakdown, weights = WEIGHTS) =>
  Math.round(
    breakdown.tasks * weights.tasks +
      breakdown.commits * weights.commits +
      breakdown.prs * weights.prs +
      breakdown.reviews * weights.reviews +
      breakdown.activity * weights.activity
  );

export const maxOf = (values) => Math.max(0, ...values);
