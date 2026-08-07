import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Runner } from "./exec.mts";
import { mayRestack, syncStack } from "./sync.mts";
import { sliceGreen } from "./status.mts";

beforeEach(() => {
  vi.stubEnv("GH_REPO", "");
  vi.stubEnv("GITHUB_REPOSITORY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("refuses to restack while a required check is in progress", () => {
  expect(mayRestack({ "ci/woodpecker/pr/verify": null })).toBe(false); // null = in-flight/none yet
});

test("allows restack while Qlty is pending", () => {
  expect(mayRestack({ qlty: "PENDING" })).toBe(true);
});

test("ignores advisory plan-required while restacking", () => {
  expect(
    mayRestack({
      "ci/woodpecker/pr/verify": "SUCCESS",
      "plan-required": "PENDING",
    }),
  ).toBe(true);
});

test("allows restack when all required checks have concluded", () => {
  expect(mayRestack({ "ci/woodpecker/pr/verify": "SUCCESS" })).toBe(true);
});

test("sliceGreen requires only successful Woodpecker verification", () => {
  expect(
    sliceGreen({
      "ci/woodpecker/pr/verify": "SUCCESS",
      qlty: "PENDING",
      "unresolved-review-threads": "FAILURE",
      "merge-conflict": "FAILURE",
    }),
  ).toBe(true);
  expect(
    sliceGreen({
      qlty: "SUCCESS",
    }),
  ).toBe(false);
});

test("syncStack fetches, checks affected PRs, then invokes Graphite sync/restack", () => {
  const calls: string[] = [];
  const run: Runner = (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "git" && args[0] === "config") {
      return "https://github.com/modernagencysales/maestro-template.git\n";
    }
    if (
      cmd === "gh" &&
      args[1] === "repos/modernagencysales/maestro-template/pulls/78"
    ) {
      return '{"head":{"sha":"abc123"},"base":{"ref":"main"},"mergeable":true}';
    }
    if (
      cmd === "gh" &&
      args[1] ===
        "repos/modernagencysales/maestro-template/commits/abc123/status"
    ) {
      return '{"statuses":[{"context":"ci/woodpecker/pr/verify","state":"success"}]}';
    }
    if (
      cmd === "gh" &&
      args[1] ===
        "repos/modernagencysales/maestro-template/commits/abc123/check-runs?per_page=100"
    ) {
      return '{"check_runs":[]}';
    }
    return "";
  };

  expect(syncStack(run, [78], false)).toEqual({ ok: true });
  expect(calls).toEqual([
    "git fetch origin main",
    "git config --get remote.origin.url",
    "gh api repos/modernagencysales/maestro-template/pulls/78",
    "gh api repos/modernagencysales/maestro-template/commits/abc123/status",
    "gh api repos/modernagencysales/maestro-template/commits/abc123/check-runs?per_page=100",
    "gt sync",
    "gt restack",
  ]);
});

test("syncStack refuses before Graphite commands when an affected PR is in flight", () => {
  const calls: string[] = [];
  const run: Runner = (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "git" && args[0] === "config") {
      return "https://github.com/modernagencysales/maestro-template.git\n";
    }
    if (
      cmd === "gh" &&
      args[1] === "repos/modernagencysales/maestro-template/pulls/78"
    ) {
      return '{"head":{"sha":"abc123"},"base":{"ref":"main"},"mergeable":true}';
    }
    if (
      cmd === "gh" &&
      args[1] ===
        "repos/modernagencysales/maestro-template/commits/abc123/status"
    ) {
      return '{"statuses":[{"context":"ci/woodpecker/pr/verify","state":"pending"}]}';
    }
    if (
      cmd === "gh" &&
      args[1] ===
        "repos/modernagencysales/maestro-template/commits/abc123/check-runs?per_page=100"
    ) {
      return '{"check_runs":[]}';
    }
    return "";
  };

  expect(syncStack(run, [78], false)).toEqual({
    ok: false,
    reason: "PR #78 has in-flight required checks",
  });
  expect(calls).toEqual([
    "git fetch origin main",
    "git config --get remote.origin.url",
    "gh api repos/modernagencysales/maestro-template/pulls/78",
    "gh api repos/modernagencysales/maestro-template/commits/abc123/status",
    "gh api repos/modernagencysales/maestro-template/commits/abc123/check-runs?per_page=100",
  ]);
});
