import { describe, it, expect } from "vitest";
import { parseRepoUrl } from "../services/github.js";

describe("parseRepoUrl", () => {
  it("parses a standard https URL", () => {
    expect(parseRepoUrl("https://github.com/facebook/react")).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses a URL with a trailing slash", () => {
    expect(parseRepoUrl("https://github.com/facebook/react/")).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses a URL with a .git suffix", () => {
    expect(parseRepoUrl("https://github.com/facebook/react.git")).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses an SSH-style URL", () => {
    expect(parseRepoUrl("git@github.com:facebook/react.git")).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses a bare github.com URL without a scheme", () => {
    expect(parseRepoUrl("github.com/facebook/react")).toEqual({ owner: "facebook", repo: "react" });
  });

  it("returns null for an empty or missing URL", () => {
    expect(parseRepoUrl("")).toBeNull();
    expect(parseRepoUrl(null)).toBeNull();
    expect(parseRepoUrl(undefined)).toBeNull();
  });

  it("returns null for a non-GitHub URL", () => {
    expect(parseRepoUrl("https://gitlab.com/facebook/react")).toBeNull();
  });
});
