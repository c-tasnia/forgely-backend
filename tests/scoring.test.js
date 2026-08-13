import { describe, it, expect } from "vitest";
import { normalize, buildBreakdown, computeScore, maxOf, WEIGHTS } from "../utils/scoring.js";

describe("normalize", () => {
  it("scales a value against the max to a 0-100 range", () => {
    expect(normalize(5, 10)).toBe(50);
    expect(normalize(10, 10)).toBe(100);
    expect(normalize(0, 10)).toBe(0);
  });

  it("returns 0 when max is 0, instead of dividing by zero", () => {
    expect(normalize(0, 0)).toBe(0);
    expect(normalize(5, 0)).toBe(0);
  });
});

describe("maxOf", () => {
  it("returns the highest value in a list", () => {
    expect(maxOf([3, 7, 1])).toBe(7);
  });

  it("returns 0 for an empty list rather than -Infinity", () => {
    expect(maxOf([])).toBe(0);
  });
});

describe("buildBreakdown", () => {
  it("normalizes each raw metric against its own group max", () => {
    const raw = { tasksCompleted: 4, commits: 10, prs: 2, reviews: 1, activityTouches: 6 };
    const maxes = { tasks: 8, commits: 10, prs: 4, reviews: 2, activity: 6 };
    expect(buildBreakdown(raw, maxes)).toEqual({
      tasks: 50,
      commits: 100,
      prs: 50,
      reviews: 50,
      activity: 100,
    });
  });
});

describe("computeScore", () => {
  it("matches a hand-computed weighted sum", () => {
    const breakdown = { tasks: 100, commits: 0, prs: 0, reviews: 0, activity: 0 };
    // tasks weight is 0.4, so an all-tasks-100 breakdown should score 40
    expect(computeScore(breakdown)).toBe(Math.round(100 * WEIGHTS.tasks));
  });

  it("gives a perfect breakdown a perfect score", () => {
    const breakdown = { tasks: 100, commits: 100, prs: 100, reviews: 100, activity: 100 };
    expect(computeScore(breakdown)).toBe(100);
  });

  it("gives an empty breakdown a zero score", () => {
    const breakdown = { tasks: 0, commits: 0, prs: 0, reviews: 0, activity: 0 };
    expect(computeScore(breakdown)).toBe(0);
  });
});
