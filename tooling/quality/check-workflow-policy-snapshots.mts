#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { buildWorkflowFiles } from "../generators/src/workflow-files";

const fixture = JSON.parse(
  readFileSync(
    "tooling/quality/fixtures/workflow-policy-snapshots.json",
    "utf8",
  ),
) as {
  readonly valid: readonly Record<string, unknown>[];
  readonly invalid: readonly Record<string, unknown>[];
};
const generated = buildWorkflowFiles({
  name: "policy gate fixture",
  system: "workflow-runtime",
  disposition: "extend",
  description: "Policy snapshot gate fixture.",
});
const content = generated.files.map(({ content }) => content).join("\n");
const runner =
  generated.files.find(({ path }) =>
    path.endsWith("workflowRunners/policyGateFixture/v1.ts"),
  )?.content ?? "";
const findings: string[] = [];
const restartSource = readFileSync(
  "packages/convex/confect/workflows/_kit/lifecycleSafety.ts",
  "utf8",
);
const policyAuthority = readFileSync(
  "packages/convex/confect/workflows/_kit/policySnapshot.ts",
  "utf8",
);

if (fixture.valid.length !== 4 || fixture.invalid.length !== 2)
  findings.push("policy fixture matrix is incomplete");
if (!content.includes("principalSnapshot: principal"))
  findings.push("kickoff does not persist durable authority");
if (!runner.includes("policySnapshot: executionArgs.policySnapshot"))
  findings.push(
    "runner does not use its authority-bound pinned policy argument",
  );
if (
  !runner.includes("policySnapshot: WorkflowPolicySnapshotValidator") ||
  !policyAuthority.includes('kind: v.literal("none")') ||
  !policyAuthority.includes("reason: v.string()")
)
  findings.push("declared-none policy is not explicit");
if (/readLatest|latestActivePolicy|activePolicy/.test(content))
  findings.push("generated workflow reads latest policy during replay");
if (!content.includes("policySnapshot,"))
  findings.push("restartable workflow args omit policy snapshot");
if (!content.includes("resolveWorkflowPolicySnapshotForRun"))
  findings.push("generated kickoff does not resolve the declared policy ID");
if (!restartSource.includes("ports.component.restart(run.componentWorkflowId"))
  findings.push("restart does not preserve the original component args");
if (/latestActivePolicy|readLatest/.test(restartSource))
  findings.push("restart reads latest policy instead of original args");
if (!policyAuthority.includes("resolved.policyHash !== posture.policyHash"))
  findings.push("pinned policy resolver does not fail closed on hash drift");

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("check:workflow-policy-snapshots passed");
