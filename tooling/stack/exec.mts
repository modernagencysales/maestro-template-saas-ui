/**
 * exec — the ONE external-command seam for stack tooling. Every git/gh/gt call
 * goes through a Runner so tests inject a fake and never spawn a real binary.
 */
import { execFileSync } from "node:child_process";
import process from "node:process";

export type Runner = (cmd: string, args: readonly string[]) => string;

/** The real runner: synchronous, throws on non-zero exit (callers catch). */
export const realRunner: Runner = (cmd, args) =>
  execFileSync(cmd, [...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

/** `git merge-tree` (real 3-way merge, no write to the worktree). */
export function gitMergeTree(run: Runner, base: string, head: string): string {
  return run("git", ["merge-tree", "--write-tree", "--name-only", base, head]);
}

export type CheckConclusion =
  | "SUCCESS"
  | "FAILURE"
  | "SKIPPED"
  | "CANCELLED"
  | "NEUTRAL"
  | "TIMED_OUT"
  | "ACTION_REQUIRED"
  | "PENDING"
  | "ERROR"
  | null;

// invariant: aligned with PR branch-protection required checks. Mutation is a
// non-PR main/scheduled confidence job and intentionally not required here.
export const REQUIRED_CHECKS = ["ci/woodpecker/pr/verify"] as const;

export const APP_PINNED_CHECKS: ReadonlySet<string> = new Set(REQUIRED_CHECKS);

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function githubRepo(run: Runner): string {
  const envRepo = process.env.GH_REPO ?? process.env.GITHUB_REPOSITORY;
  if (envRepo !== undefined && envRepo.trim() !== "") return envRepo;

  const remote = run("git", ["config", "--get", "remote.origin.url"]).trim();
  const https = remote.match(
    /^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/,
  );
  if (https?.[1] !== undefined) return https[1];
  const ssh = remote.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  if (ssh?.[1] !== undefined) return ssh[1];
  throw new Error(`Cannot infer GitHub repo from remote.origin.url: ${remote}`);
}

function conclusionForStatus(state: string): CheckConclusion {
  if (state === "success") return "SUCCESS";
  if (state === "pending") return "PENDING";
  if (state === "failure") return "FAILURE";
  if (state === "error") return "ERROR";
  return null;
}

function conclusionForCheckRun(
  status: string,
  conclusion: string,
): CheckConclusion {
  if (status !== "completed") return "PENDING";
  if (conclusion === "success") return "SUCCESS";
  if (conclusion === "failure") return "FAILURE";
  if (conclusion === "skipped") return "SKIPPED";
  if (conclusion === "cancelled") return "CANCELLED";
  if (conclusion === "neutral") return "NEUTRAL";
  if (conclusion === "timed_out") return "TIMED_OUT";
  if (conclusion === "action_required") return "ACTION_REQUIRED";
  return null;
}

/** Head SHA + base ref for a PR. */
export function ghPrInfo(
  run: Runner,
  prNumber: number,
): { headSha: string; base: string; mergeable: boolean | null } {
  const repo = githubRepo(run);
  const pr = object(
    JSON.parse(run("gh", ["api", `repos/${repo}/pulls/${String(prNumber)}`])),
  );
  const headSha = text(object(pr.head).sha);
  if (headSha === "")
    throw new Error(`PR #${String(prNumber)} has no head SHA`);
  const base = text(object(pr.base).ref);
  const rawMergeable = pr.mergeable;
  const mergeable =
    rawMergeable === true ? true : rawMergeable === false ? false : null;
  return { headSha, base, mergeable };
}

/** Required-check conclusions for a PR, from the GitHub API via gh. */
export function ghCheckStatuses(
  run: Runner,
  prNumber: number,
): Record<string, CheckConclusion> {
  const repo = githubRepo(run);
  const pr = object(
    JSON.parse(run("gh", ["api", `repos/${repo}/pulls/${String(prNumber)}`])),
  );
  const headSha = text(object(pr.head).sha);
  if (headSha === "")
    throw new Error(`PR #${String(prNumber)} has no head SHA`);

  const combined = object(
    JSON.parse(run("gh", ["api", `repos/${repo}/commits/${headSha}/status`])),
  );
  const statuses = new Map<string, CheckConclusion>();
  for (const status of array(combined.statuses).map(object)) {
    const context = text(status.context);
    if (context === "" || statuses.has(context)) continue;
    statuses.set(context, conclusionForStatus(text(status.state)));
  }

  const checkRuns = object(
    JSON.parse(
      run("gh", [
        "api",
        `repos/${repo}/commits/${headSha}/check-runs?per_page=100`,
      ]),
    ),
  );
  for (const checkRun of array(checkRuns.check_runs).map(object)) {
    const name = text(checkRun.name);
    if (name === "") continue;
    statuses.set(
      name,
      conclusionForCheckRun(text(checkRun.status), text(checkRun.conclusion)),
    );
  }
  return Object.fromEntries(statuses);
}

/** Set commit statuses on a PR, skipping app-pinned checks. */
export function ghSetStatuses(
  run: Runner,
  prNumber: number,
  state: "success" | "pending" | "failure",
  description: string,
): void {
  const { headSha } = ghPrInfo(run, prNumber);
  const repo = githubRepo(run);
  for (const ctx of REQUIRED_CHECKS) {
    if (APP_PINNED_CHECKS.has(ctx)) continue;
    run("gh", [
      "api",
      `repos/${repo}/statuses/${headSha}`,
      "-X",
      "POST",
      "-f",
      `state=${state}`,
      "-f",
      `context=${ctx}`,
      "-f",
      `description=${description}`,
    ]);
  }
}

/** Retarget a PR's base branch. */
export function ghRetargetPr(
  run: Runner,
  prNumber: number,
  base: string,
): void {
  const repo = githubRepo(run);
  run("gh", [
    "api",
    `repos/${repo}/pulls/${String(prNumber)}`,
    "-X",
    "PATCH",
    "-f",
    `base=${base}`,
  ]);
}

/** Squash-merge a PR. Returns the merge commit SHA. */
export function ghMergePr(run: Runner, prNumber: number): string {
  const repo = githubRepo(run);
  const result = object(
    JSON.parse(
      run("gh", [
        "api",
        `repos/${repo}/pulls/${String(prNumber)}/merge`,
        "-X",
        "PUT",
        "-f",
        "merge_method=squash",
      ]),
    ),
  );
  if (result.merged !== true)
    throw new Error(`PR #${String(prNumber)} merge failed`);
  return text(result.sha);
}

/** Resolve all review threads on a PR via GraphQL. */
export function ghResolveThreads(run: Runner, prNumber: number): number {
  const repo = githubRepo(run);
  const [owner, name] = repo.split("/");
  const query = `query { repository(owner: "${owner}", name: "${name}") { pullRequest(number: ${String(prNumber)}) { reviewThreads(first: 100) { nodes { id isResolved isOutdated } } } } }`;
  const result = object(
    JSON.parse(run("gh", ["api", "graphql", "-f", `query=${query}`])),
  );
  const threads = array(
    object(
      object(object(object(result.data).repository).pullRequest).reviewThreads,
    ).nodes,
  ).map(object);
  let resolved = 0;
  for (const thread of threads) {
    if (thread.isResolved === true) continue;
    const id = text(thread.id);
    if (id === "") continue;
    const mutation = `mutation { resolveReviewThread(input: {threadId: "${id}"}) { thread { isResolved } } }`;
    run("gh", ["api", "graphql", "-f", `query=${mutation}`]);
    resolved++;
  }
  return resolved;
}
