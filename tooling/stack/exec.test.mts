import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  type Runner,
  ghCheckStatuses,
  ghPrInfo,
  ghSetStatuses,
  gitMergeTree,
  APP_PINNED_CHECKS,
  REQUIRED_CHECKS,
} from "./exec.mts";

beforeEach(() => {
  vi.stubEnv("GH_REPO", "");
  vi.stubEnv("GITHUB_REPOSITORY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("gitMergeTree passes the conflict-style args and returns stdout", () => {
  const run = vi.fn<Runner>(() => "treeoid\n");
  const out = gitMergeTree(run, "origin/main", "HEAD");
  expect(run).toHaveBeenCalledWith("git", [
    "merge-tree",
    "--write-tree",
    "--name-only",
    "origin/main",
    "HEAD",
  ]);
  expect(out).toBe("treeoid\n");
});

const PR_RESPONSE = JSON.stringify({
  head: { sha: "abc123" },
  base: { ref: "main" },
  mergeable: true,
});

function makeFakeRunner(): Runner {
  return vi.fn<Runner>((cmd, args) => {
    if (cmd === "git")
      return "https://github.com/modernagencysales/maestro-template.git\n";
    if (args[1] === "repos/modernagencysales/maestro-template/pulls/64") {
      return PR_RESPONSE;
    }
    if (
      args[1] ===
      "repos/modernagencysales/maestro-template/commits/abc123/status"
    ) {
      return JSON.stringify({
        statuses: [
          { context: "verify", state: "success" },
          { context: "qlty", state: "pending" },
        ],
      });
    }
    if (
      args[1] ===
      "repos/modernagencysales/maestro-template/commits/abc123/check-runs?per_page=100"
    ) {
      return JSON.stringify({
        check_runs: [
          { name: "taste", status: "queued" },
          {
            name: "contract-review",
            status: "completed",
            conclusion: "failure",
          },
        ],
      });
    }
    return "{}";
  });
}

test("ghCheckStatuses parses the required checks into a name->conclusion map", () => {
  const run = makeFakeRunner();
  expect(ghCheckStatuses(run, 64)).toEqual({
    verify: "SUCCESS",
    taste: "PENDING",
    qlty: "PENDING",
    "contract-review": "FAILURE",
  });
});

test("ghPrInfo extracts head sha, base ref, and mergeability", () => {
  const run = makeFakeRunner();
  const info = ghPrInfo(run, 64);
  expect(info).toEqual({ headSha: "abc123", base: "main", mergeable: true });
});

test("ghSetStatuses skips app-pinned checks", () => {
  const calls: string[] = [];
  const run: Runner = (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "git")
      return "https://github.com/modernagencysales/maestro-template.git\n";
    if (args[1] === "repos/modernagencysales/maestro-template/pulls/64")
      return PR_RESPONSE;
    return "{}";
  };
  ghSetStatuses(run, 64, "success", "test");
  const contextArgs = calls
    .filter((c) => c.includes("statuses/abc123"))
    .map((c) => {
      const match = c.match(/context=([^\s]+)/);
      return match?.[1] ?? "";
    });
  for (const ctx of APP_PINNED_CHECKS) {
    expect(contextArgs).not.toContain(ctx);
  }
  expect(contextArgs).toEqual([]);
});

test("REQUIRED_CHECKS admits only app-pinned Woodpecker verification", () => {
  expect(REQUIRED_CHECKS).toEqual(["ci/woodpecker/pr/verify"]);
  expect([...APP_PINNED_CHECKS]).toEqual(["ci/woodpecker/pr/verify"]);
});
