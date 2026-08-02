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
  expect(mayRestack({ verify: null })).toBe(false); // null = in-flight/none yet
});

test("refuses to restack while a required status context is pending", () => {
  expect(mayRestack({ qlty: "PENDING" })).toBe(false);
});

test("ignores advisory plan-required while restacking", () => {
  expect(mayRestack({ verify: "SUCCESS", "plan-required": "PENDING" })).toBe(
    true,
  );
});

test("allows restack when all required checks have concluded", () => {
  expect(mayRestack({ verify: "SUCCESS" })).toBe(true);
});

test("sliceGreen requires SUCCESS on all required checks", () => {
  expect(
    sliceGreen({
      verify: "SUCCESS",
      qlty: "SUCCESS",
      "ci/woodpecker/pr/verify": "SUCCESS",
      "unresolved-review-threads": "SUCCESS",
      "merge-conflict": "SUCCESS",
    }),
  ).toBe(true);
  expect(
    sliceGreen({
      verify: "SUCCESS",
      qlty: "SUCCESS",
      taste: null,
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
      return '{"statuses":[{"context":"verify","state":"success"}]}';
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
      return '{"statuses":[{"context":"verify","state":"pending"}]}';
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
