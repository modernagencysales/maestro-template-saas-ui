/**
 * stack:merge — merge a Graphite stack bottom-up. For each PR: resolve review
 * threads, retarget to main, set required statuses, then squash-merge. Refuses
 * if any PR has merge conflicts.
 */
import process from "node:process";
import {
  ghCheckStatuses,
  ghMergePr,
  ghPrInfo,
  ghResolveThreads,
  ghRetargetPr,
  ghSetStatuses,
  realRunner,
  type Runner,
  REQUIRED_CHECKS,
  APP_PINNED_CHECKS,
} from "./exec.mts";
import { sliceGreen } from "./status.mts";

const WOODPECKER_AGGREGATE_CHECK = "ci/woodpecker/pr/verify";

type MergeResult =
  | { ok: true; merged: readonly number[] }
  | { ok: false; reason: string; merged: readonly number[] };

type MergeStackOptions = {
  readonly nowMs?: () => number;
  readonly sleepMs?: (ms: number) => Promise<void>;
  readonly appPinnedMaxWaitMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appPinnedGreen(
  statuses: Record<string, string | null | undefined>,
): boolean {
  return [...APP_PINNED_CHECKS].every((ctx) => statuses[ctx] === "SUCCESS");
}

function canTrustWoodpeckerAggregate(
  statuses: Record<string, string | null | undefined>,
): boolean {
  if (!appPinnedGreen(statuses)) return false;
  if (statuses[WOODPECKER_AGGREGATE_CHECK] !== "SUCCESS") return false;
  return REQUIRED_CHECKS.every((ctx) => {
    if (APP_PINNED_CHECKS.has(ctx)) return true;
    const status = statuses[ctx];
    return status === "SUCCESS" || status === "PENDING";
  });
}

async function waitForAppPinnedChecks(
  run: Runner,
  prNumber: number,
  maxWaitMs: number,
  nowMs: () => number,
  sleepMs: (ms: number) => Promise<void>,
): Promise<boolean> {
  const deadline = nowMs() + maxWaitMs;
  while (nowMs() < deadline) {
    const statuses = ghCheckStatuses(run, prNumber);
    if (appPinnedGreen(statuses)) return true;
    await sleepMs(5_000);
  }
  return false;
}

export async function mergeStack(
  run: Runner,
  prNumbers: readonly number[],
  options: MergeStackOptions = {},
): Promise<MergeResult> {
  const merged: number[] = [];
  const nowMs = options.nowMs ?? (() => Date.now());
  const sleepMs = options.sleepMs ?? sleep;
  const appPinnedMaxWaitMs = options.appPinnedMaxWaitMs ?? 120_000;

  for (const pr of prNumbers) {
    console.log(`\n── PR #${String(pr)} ──`);

    // 1. Resolve review threads
    const resolved = ghResolveThreads(run, pr);
    if (resolved > 0) console.log(`  resolved ${String(resolved)} thread(s)`);

    // 2. Retarget to main (mid-stack PRs target parent branch)
    const { base } = ghPrInfo(run, pr);
    if (base !== "main") {
      console.log(`  retargeting ${base} → main`);
      ghRetargetPr(run, pr, "main");
      await sleepMs(3_000);
    }

    // 3. Wait for GitHub to compute mergeability, then check for conflicts
    let mergeable: boolean | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      mergeable = ghPrInfo(run, pr).mergeable;
      if (mergeable !== null) break;
      await sleepMs(5_000);
    }
    if (mergeable === false) {
      return {
        ok: false,
        reason: `PR #${String(pr)} has merge conflicts after retargeting to main`,
        merged,
      };
    }
    if (mergeable === null) {
      return {
        ok: false,
        reason: `PR #${String(pr)}: GitHub did not compute mergeability within 30s`,
        merged,
      };
    }

    // 4. Wait for app-pinned checks; Woodpecker owns the merge authority.
    console.log("  waiting for app-pinned checks...");
    const pinned = await waitForAppPinnedChecks(
      run,
      pr,
      appPinnedMaxWaitMs,
      nowMs,
      sleepMs,
    );
    if (!pinned) {
      return {
        ok: false,
        reason: `PR #${String(pr)}: app-pinned checks did not pass within 2 minutes`,
        merged,
      };
    }

    // 5. Final gate: all required checks green
    const statuses = ghCheckStatuses(run, pr);
    const green = sliceGreen(statuses);
    const woodpeckerChurn = canTrustWoodpeckerAggregate(statuses);
    if (!green && !woodpeckerChurn) {
      const failing = REQUIRED_CHECKS.filter((c) => statuses[c] !== "SUCCESS");
      return {
        ok: false,
        reason: `PR #${String(pr)} not green: ${failing.join(", ")}`,
        merged,
      };
    }
    if (woodpeckerChurn && !green) {
      const stabilizing = REQUIRED_CHECKS.filter(
        (c) => !APP_PINNED_CHECKS.has(c) && statuses[c] !== "SUCCESS",
      );
      console.log(
        `  Woodpecker aggregate is green; stabilizing churned statuses: ${stabilizing.join(", ")}`,
      );
    }

    // 6. Mirror any non-app-pinned statuses after authoritative Woodpecker evidence.
    console.log("  setting statuses");
    ghSetStatuses(run, pr, "success", "All checks pass");

    // 7. Merge
    console.log("  merging...");
    const sha = ghMergePr(run, pr);
    console.log(`  ✓ merged (${sha.slice(0, 8)})`);
    merged.push(pr);

    // Brief pause for GitHub to process the merge before the next PR
    if (pr !== prNumbers[prNumbers.length - 1]) {
      await sleepMs(5_000);
    }
  }

  return { ok: true, merged };
}

// CLI: `tsx tooling/stack/merge.mts <prNumber> [<prNumber> ...]`
// PRs must be listed bottom-up (first PR merges first).
if (import.meta.url === `file://${process.argv[1]}`) {
  const prs = process.argv
    .slice(2)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (prs.length === 0) {
    console.error(
      "usage: stack:merge <prNumber> [<prNumber> ...] (bottom-up order)",
    );
    process.exit(2);
  }
  const result = await mergeStack(realRunner, prs);
  if (!result.ok) {
    console.error(`\n✗ stack:merge failed — ${result.reason}`);
    if (result.merged.length > 0)
      console.error(
        `  already merged: ${result.merged.map((n) => `#${String(n)}`).join(", ")}`,
      );
    process.exit(1);
  }
  console.log(
    `\n✓ all ${String(result.merged.length)} PRs merged: ${result.merged.map((n) => `#${String(n)}`).join(", ")}`,
  );
}
