#!/usr/bin/env node
import { buildWorkflowFiles } from "../generators/src/index";
import { readFileSync } from "node:fs";

const generated = buildWorkflowFiles({
  name: "principal gate fixture",
  system: "workflow-runtime",
  disposition: "extend",
  description: "Principal propagation gate fixture.",
});
const file = (suffix: string) =>
  generated.files.find(({ path }) => path.endsWith(suffix))?.content ?? "";
const spec = file("workflowContracts/principalGateFixture.spec.ts");
const impl = file("workflowContracts/principalGateFixture.impl.ts");
const runner = file("workflowRunners/principalGateFixture/v1.ts");
const registry = file("workflows/principalGateFixture/v1.registry.ts");
const subworkflows = readFileSync(
  "packages/convex/confect/workflows/_kit/subworkflows.ts",
  "utf8",
);
const findings: string[] = [];

for (const forbidden of ["actorId", "authEpoch", "systemId", "grants"]) {
  if (spec.includes(forbidden))
    findings.push(`public start contract exposes reserved field ${forbidden}`);
}
for (const required of [
  "createWorkflowUserPrincipal",
  "principalSnapshot: principal",
  "policySnapshot,",
]) {
  if (!impl.includes(required))
    findings.push(`generated start misses ${required}`);
}
for (const required of [
  "version: v.literal(2)",
  "principal: WorkflowPrincipalValidator",
  "policySnapshot: WorkflowPolicySnapshotValidator",
  "policySnapshot: args.policySnapshot",
]) {
  if (!runner.includes(required))
    findings.push(`generated runner misses ${required}`);
}
if (!registry.includes("buildWorkflowCapabilityArgs"))
  findings.push("generated capability registry misses authority mapper");
for (const required of [
  "hasReservedWorkflowIdentityField(mappedArgs)",
  "narrowed child principal cannot add grants",
]) {
  if (!subworkflows.includes(required))
    findings.push(`child workflow authority misses ${required}`);
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("check:workflow-principal-propagation passed");
