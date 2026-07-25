import { describe, expect, it } from "vitest";
import {
  validateWorkflowRunnerSource,
  type WorkflowSemanticFinding,
} from "./check-workflow-semantics.mts";

const ids = (findings: readonly WorkflowSemanticFinding[]) =>
  findings.map((finding) => finding.ruleId);

describe("check:workflow-semantics", () => {
  it("allows the generated Confect runner boundary", () => {
    expect(
      validateWorkflowRunnerSource(
        "packages/convex/confect/workflowRunners/brief.ts",
        'import { defineWorkflow } from "@convex-dev/workflow";\nexport const run = defineWorkflow(component, options);',
      ),
    ).toEqual([]);
  });

  it("rejects raw imports and ambient effects in real runner-shaped source", () => {
    const findings = validateWorkflowRunnerSource(
      "packages/convex/convex/workflowRunners/brief.ts",
      'import { WorkflowManager } from "@convex-dev/workflow";\nconst manager = new WorkflowManager(component);\nexport const run = () => fetch(process.env.URL);',
    );
    expect(ids(findings)).toEqual(
      expect.arrayContaining([
        "WF-RAW-IMPORT",
        "WF-RAW-MANAGER",
        "WF-HANDLER-IO",
        "WF-HANDLER-ENV",
      ]),
    );
    expect(findings.every((item) => item.repair.length > 0)).toBe(true);
  });

  it("does not falsely reject normalized Date or seeded Math.random", () => {
    expect(
      validateWorkflowRunnerSource(
        "packages/convex/confect/workflowRunners/clock.ts",
        "export const handler = () => [new Date(), Date.now(), Math.random()];",
      ),
    ).toEqual([]);
  });
});
