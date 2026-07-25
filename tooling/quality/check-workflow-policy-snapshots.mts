#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { buildWorkflowFiles } from "../generators/src/index";

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

if (fixture.valid.length !== 4 || fixture.invalid.length !== 2)
  findings.push("policy fixture matrix is incomplete");
if (!content.includes("principalSnapshot: principal"))
  findings.push("kickoff does not persist durable authority");
if (!runner.includes("policySnapshot: args.policySnapshot"))
  findings.push("runner does not use its pinned policy argument");
if (!runner.includes('kind: v.literal("none")'))
  findings.push("declared-none policy is not explicit");
if (/readLatest|latestActivePolicy|activePolicy/.test(content))
  findings.push("generated workflow reads latest policy during replay");
if (!content.includes("policySnapshot,"))
  findings.push("restartable workflow args omit policy snapshot");

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("check:workflow-policy-snapshots passed");
