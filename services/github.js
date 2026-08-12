const GITHUB_API = "https://api.github.com";
const cache = new Map(); // cacheKey -> { data, expiresAt }
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes — keeps us well under rate limits

const cached = async (key, fn) => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  const data = await fn();
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
};

export const parseRepoUrl = (url) => {
  if (!url) return null;
  const match = url.trim().match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?\/?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
};

const githubFetch = async (path) => {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `token ${token}` } : {}),
    },
  });

  if (res.status === 404) {
    const err = new Error("Repository not found — check the URL and that it's public (or that GITHUB_TOKEN can see it)");
    err.statusCode = 404;
    throw err;
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const err = new Error(
      remaining === "0"
        ? "GitHub API rate limit hit. Set GITHUB_TOKEN in the backend .env for higher limits."
        : "GitHub API request forbidden"
    );
    err.statusCode = 503;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`GitHub API error (${res.status})`);
    err.statusCode = 502;
    throw err;
  }
  return res.json();
};

export const getRepoActivity = async (owner, repo) => {
  const cacheKey = `activity:${owner}/${repo}`.toLowerCase();
  return cached(cacheKey, async () => {
    const [commits, openPRs, openIssuesRaw, contributors] = await Promise.all([
      githubFetch(`/repos/${owner}/${repo}/commits?per_page=10`),
      githubFetch(`/search/issues?q=repo:${owner}/${repo}+type:pr+state:open`),
      githubFetch(`/search/issues?q=repo:${owner}/${repo}+type:issue+state:open`),
      githubFetch(`/repos/${owner}/${repo}/contributors?per_page=10`),
    ]);

    return {
      repo: { owner, name: repo, url: `https://github.com/${owner}/${repo}` },
      commits: commits.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0],
        author: c.author?.login || c.commit.author?.name || "unknown",
        avatarUrl: c.author?.avatar_url || null,
        date: c.commit.author?.date,
        url: c.html_url,
      })),
      openPRs: openPRs.total_count,
      openIssues: openIssuesRaw.total_count,
      contributors: contributors.map((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
        url: c.html_url,
      })),
    };
  });
};

// Merged PR count authored by a specific GitHub username, for contribution scoring.
export const getUserMergedPRCount = async (owner, repo, username) => {
  const cacheKey = `prs:${owner}/${repo}:${username}`.toLowerCase();
  return cached(cacheKey, async () => {
    const result = await githubFetch(
      `/search/issues?q=repo:${owner}/${repo}+type:pr+author:${username}+is:merged`
    );
    return result.total_count;
  });
};

// PR review count by a specific GitHub username, for contribution scoring.
export const getUserReviewCount = async (owner, repo, username) => {
  const cacheKey = `reviews:${owner}/${repo}:${username}`.toLowerCase();
  return cached(cacheKey, async () => {
    const result = await githubFetch(
      `/search/issues?q=repo:${owner}/${repo}+type:pr+reviewed-by:${username}`
    );
    return result.total_count;
  });
};
