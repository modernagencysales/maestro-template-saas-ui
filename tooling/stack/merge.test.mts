import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { REQUIRED_CHECKS, type Runner } from "./exec.mts";
import { mergeStack } from "./merge.mts";

const WOODPECKER_AGGREGATE_CHECK = "ci/woodpecker/pr/verify";

beforeEach(() => {
  vi.stubEnv("GH_REPO", "");
  vi.stubEnv("GITHUB_REPOSITORY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function successStatuses() {
  return {
    statuses: REQUIRED_CHECKS.map((context) => ({
      context,
      state: "success",
    })),
  };
}

function apiPath(args: readonly string[]): string {
  return args[1] ?? "";
}

function makeRunner(
  overrides: {
    readonly base?: string;
    readonly mergeable?: boolean | null;
    readonly statuses?: () => unknown;
  } = {},
): Runner {
  const base = overrides.base ?? "main";
  const mergeable = overrides.mergeable ?? true;
  const statuses = overrides.statuses ?? successStatuses;
  return vi.fn<Runner>((cmd, args) => {
    if (cmd === "git") {
      return "https://github.com/modernagencysales/maestro-template.git\n";
    }

    const path = apiPath(args);
    if (path === "repos/modernagencysales/maestro-template/pulls/64") {
      return JSON.stringify({
        head: { sha: "abc123" },
        base: { ref: base },
        mergeable,
      });
    }
    if (
      path === "repos/modernagencysales/maestro-template/commits/abc123/status"
    ) {
      return JSON.stringify(statuses());
    }
    if (
      path ===
      "repos/modernagencysales/maestro-template/commits/abc123/check-runs?per_page=100"
    ) {
      return JSON.stringify({ check_runs: [] });
    }
    if (path === "repos/modernagencysales/maestro-template/pulls/64/merge") {
      return JSON.stringify({ merged: true, sha: "deadbeefcafebabe" });
    }
    if (path === "graphql") {
      return JSON.stringify({ data: { repository: { pullRequest: null } } });
    }
    return "{}";
  });
}

test("mergeStack mirrors statuses and merges after required checks are green", async () => {
  const run = makeRunner();

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
  });

  expect(result).toEqual({ ok: true, merged: [64] });
  const calls = vi
    .mocked(run)
    .mock.calls.map(([cmd, args]) => `${cmd} ${args.join(" ")}`);
  const statusIndex = calls.findIndex((call) =>
    call.includes("statuses/abc123"),
  );
  const mergeIndex = calls.findIndex((call) => call.includes("pulls/64/merge"));
  expect(statusIndex).toBeGreaterThan(-1);
  expect(mergeIndex).toBeGreaterThan(statusIndex);
});

test("mergeStack stabilizes churned required statuses after Woodpecker aggregate success", async () => {
  const run = makeRunner({
    statuses: () => ({
      statuses: [
        { context: WOODPECKER_AGGREGATE_CHECK, state: "success" },
        ...REQUIRED_CHECKS.map((context) => ({
          context,
          state: context === "verify" ? "success" : "pending",
        })),
      ],
    }),
  });

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
  });

  expect(result).toEqual({ ok: true, merged: [64] });
  const calls = vi
    .mocked(run)
    .mock.calls.map(([cmd, args]) => `${cmd} ${args.join(" ")}`);
  const statusIndex = calls.findIndex((call) =>
    call.includes("statuses/abc123"),
  );
  const mergeIndex = calls.findIndex((call) => call.includes("pulls/64/merge"));
  expect(statusIndex).toBeGreaterThan(-1);
  expect(mergeIndex).toBeGreaterThan(statusIndex);
});

test("mergeStack aborts on merge conflicts before setting statuses", async () => {
  const run = makeRunner({ mergeable: false });

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
  });

  expect(result).toEqual({
    ok: false,
    reason: "PR #64 has merge conflicts after retargeting to main",
    merged: [],
  });
  expect(
    vi
      .mocked(run)
      .mock.calls.some(([, args]) =>
        args.join(" ").includes("statuses/abc123"),
      ),
  ).toBe(false);
});

test("mergeStack does not wait for advisory plan-required", async () => {
  const run = makeRunner({
    statuses: () => ({
      statuses: [
        ...REQUIRED_CHECKS.map((context) => ({ context, state: "success" })),
        { context: "plan-required", state: "pending" },
      ],
    }),
  });

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
    appPinnedMaxWaitMs: 1,
  });

  expect(result).toEqual({ ok: true, merged: [64] });
});

test("mergeStack does not stabilize churned statuses without Woodpecker aggregate success", async () => {
  const run = makeRunner({
    statuses: () => ({
      statuses: [
        { context: WOODPECKER_AGGREGATE_CHECK, state: "pending" },
        ...REQUIRED_CHECKS.map((context) => ({
          context,
          state: "pending",
        })),
      ],
    }),
  });

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
  });

  expect(result).toEqual({
    ok: false,
    reason:
      "PR #64 not green: verify, qlty, buildkite/taste, unresolved-review-threads, merge-conflict, buildkite/contract-review",
    merged: [],
  });
  expect(
    vi
      .mocked(run)
      .mock.calls.some(([, args]) =>
        args.join(" ").includes("statuses/abc123"),
      ),
  ).toBe(false);
});

test("mergeStack does not stabilize missing required statuses", async () => {
  const run = makeRunner({
    statuses: () => ({
      statuses: [
        { context: WOODPECKER_AGGREGATE_CHECK, state: "success" },
        { context: "plan-required", state: "success" },
        { context: "verify", state: "success" },
      ],
    }),
  });

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
  });

  expect(result).toEqual({
    ok: false,
    reason:
      "PR #64 not green: qlty, buildkite/taste, unresolved-review-threads, merge-conflict, buildkite/contract-review",
    merged: [],
  });
  expect(
    vi
      .mocked(run)
      .mock.calls.some(([, args]) =>
        args.join(" ").includes("statuses/abc123"),
      ),
  ).toBe(false);
});

test("mergeStack does not stamp success over a failing required check", async () => {
  const run = makeRunner({
    statuses: () => ({
      statuses: REQUIRED_CHECKS.map((context) => ({
        context,
        state: context === "verify" ? "failure" : "success",
      })),
    }),
  });

  const result = await mergeStack(run, [64], {
    nowMs: () => 0,
    sleepMs: async () => {},
  });

  expect(result).toEqual({
    ok: false,
    reason: "PR #64 not green: verify",
    merged: [],
  });
  expect(
    vi
      .mocked(run)
      .mock.calls.some(([, args]) =>
        args.join(" ").includes("statuses/abc123"),
      ),
  ).toBe(false);
});
