import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");

type SourceFactEvidence = {
  readonly expected: string;
  readonly packageName: "@convex-dev/workflow" | "@convex-dev/workpool";
  readonly packageVersion: "0.4.4" | "0.4.7";
  readonly source: string;
  readonly includes: readonly string[];
  readonly scopedExclusion?: {
    readonly start: string;
    readonly end: string;
    readonly excludes: readonly string[];
  };
};

export const SOURCE_FACT_EVIDENCE = {
  scheduledChildOptionPropagation: {
    expected: "unsupported-on-0.4.4",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/component/journal.ts",
    includes: [
      "workflowHandle: step.handle",
      "workflowArgs: step.args",
      "startAsync: true",
    ],
    scopedExclusion: {
      start: '} else if (step.kind === "workflow") {',
      end: "} else if (step.runResult)",
      excludes: ["schedulerOptions", "runAt", "runAfter"],
    },
  },
  defaultStart: {
    expected: "eager-first-poll-with-terminal-id-on-caught-failure",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/client/workflowMutation.ts",
    includes: [
      "createOnly: !args.startAsync",
      "if (args.startAsync)",
      "return workflowId",
    ],
  },
  queuedStart: {
    expected: "startAsync-true-via-workpool",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/client/index.ts",
    includes: [
      "With `startAsync` set to true",
      "start asynchronously via the internal workpool",
      "startAsync: true",
    ],
  },
  payloadPreview: {
    expected: "component-receives-values-before-application-redaction",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/component/oversizedValues.ts",
    includes: [
      "JSON.stringify(convexToJson(returnValue as Value))",
      "Preview: ${truncatedPreview(returnValue)}",
    ],
  },
  cleanup: {
    expected: "batched-and-nested-asynchronous-residuals-possible",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/component/workflow.ts",
    includes: [
      "const CLEANUP_BATCH_SIZE = 256",
      ".take(CLEANUP_BATCH_SIZE)",
      "internal.workflow.cleanupContinue",
      "api.workflow.cleanup",
    ],
  },
  eventIdOwnership: {
    expected: "workflow-component",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/component/schema.ts",
    includes: [
      "export const event = {",
      'workflowId: v.id("workflows")',
      "events: defineTable(event)",
    ],
  },
  workpoolSchedule: {
    expected: "requested-runAt-is-not-actual-start-and-may-be-clamped",
    packageName: "@convex-dev/workpool",
    packageVersion: "0.4.7",
    source: "src/component/shared.ts",
    includes: [
      "export function boundScheduledTime",
      "scheduled time is too old, defaulting to now",
      "scheduled time is too far in the future, defaulting to 1 year from now",
    ],
  },
  terminalRetryError: {
    expected: "NonRetryableError",
    packageName: "@convex-dev/workpool",
    packageVersion: "0.4.7",
    source: "src/component/errors.ts",
    includes: [
      "export class NonRetryableError",
      "__convexWorkpoolNonRetryable",
      "isNonRetryableError",
    ],
  },
  runtimeClosure: {
    expected: "function-handle-does-not-freeze-transitive-closure",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/client/step.ts",
    includes: [
      "handle: await createFunctionHandle(target.function)",
      "target.args",
    ],
  },
  workpool047DuplicateCompletion: {
    expected: "behaviorally-reproduced-attempt-mutation-before-dedup",
    packageName: "@convex-dev/workpool",
    packageVersion: "0.4.7",
    source: "src/component/stateMachine.test.ts",
    includes: ["duplicate complete with correct attempt -> BUG"],
  },
  workpool047CancelRace: {
    expected: "behaviorally-reproduced-concurrent-double-delete",
    packageName: "@convex-dev/workpool",
    packageVersion: "0.4.7",
    source: "src/component/stateMachine.test.ts",
    includes: ["multiple cancels for same work -> BUG"],
  },
  date: {
    expected: "generation-state-normalized-except-locale-timezone-methods",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/client/environment.ts",
    includes: [
      "createDeterministicDate",
      "getGenerationState",
      "getTimezoneOffset() - should return 0 (UTC)",
      "toLocaleString() - should use fixed locale",
    ],
  },
  mathRandom: {
    expected: "seeded-by-workflow-id",
    packageName: "@convex-dev/workflow",
    packageVersion: "0.4.4",
    source: "src/client/environment.ts",
    includes: [
      "patchedMath.random = seededRandom",
      "patchMath(originals.Math as typeof Math, workflowId)",
    ],
  },
} as const satisfies Record<string, SourceFactEvidence>;

describe("pinned compatibility source facts", () => {
  it("maps every matrix sourceFact to exact pinned package evidence", async () => {
    const matrix = JSON.parse(
      await readFile(
        resolve(repoRoot, "docs/template/convex-compatibility.json"),
        "utf8",
      ),
    ) as { readonly sourceFacts: Readonly<Record<string, string>> };

    expect(Object.keys(SOURCE_FACT_EVIDENCE).sort()).toEqual(
      Object.keys(matrix.sourceFacts).sort(),
    );

    for (const [key, evidence] of Object.entries(SOURCE_FACT_EVIDENCE)) {
      expect(matrix.sourceFacts[key], key).toBe(evidence.expected);
      const packageRoot = resolve(
        repoRoot,
        "packages/convex/node_modules",
        evidence.packageName,
      );
      const packageJson = JSON.parse(
        await readFile(resolve(packageRoot, "package.json"), "utf8"),
      ) as { readonly version: string };
      expect(packageJson.version, key).toBe(evidence.packageVersion);
      const source = await readFile(
        resolve(packageRoot, evidence.source),
        "utf8",
      );
      for (const fragment of evidence.includes) {
        expect(source, `${key}: ${fragment}`).toContain(fragment);
      }
      if ("scopedExclusion" in evidence) {
        const start = source.indexOf(evidence.scopedExclusion.start);
        const end = source.indexOf(evidence.scopedExclusion.end, start + 1);
        expect(start, `${key}: exclusion scope start`).toBeGreaterThanOrEqual(
          0,
        );
        expect(end, `${key}: exclusion scope end`).toBeGreaterThan(start);
        const scope = source.slice(start, end);
        for (const fragment of evidence.scopedExclusion.excludes) {
          expect(scope, `${key}: excludes ${fragment}`).not.toContain(fragment);
        }
      }
    }
  });
});
