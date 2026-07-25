import { describe, expect, it } from "vitest";
import {
  OFFICIAL_WORKFLOW_PRIMITIVES,
  WORKFLOW_GRAPH_FIELDS,
  WORKFLOW_SCHEMA_FIELDS,
  WORKFLOW_SEMANTICS,
  defineWorkflowSchemaFields,
  renderWorkflowSemanticsMarkdown,
  validateWorkflowSemanticCoverage,
  validateWorkflowSemantics,
} from "./contract";

describe("workflow semantics contract", () => {
  it("keeps schema constructors on the exact exported field registry", () => {
    expect(
      defineWorkflowSchemaFields("retry", {
        maxAttempts: "validator",
        backoffMs: "validator",
      }),
    ).toEqual({ maxAttempts: "validator", backoffMs: "validator" });
    expect(WORKFLOW_SCHEMA_FIELDS.retry).toEqual(["maxAttempts", "backoffMs"]);

    const defineUnchecked = defineWorkflowSchemaFields as (
      section: "retry",
      fields: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(() =>
      defineUnchecked("retry", { maxAttempts: "validator" }),
    ).toThrow("Workflow retry schema fields differ from registry");
    expect(() =>
      defineUnchecked("retry", {
        maxAttempts: "validator",
        backoffMs: "validator",
        surprise: "validator",
      }),
    ).toThrow("Workflow retry schema fields differ from registry");
  });

  it("classifies every graph field and official primitive exactly once", () => {
    const subjects = WORKFLOW_SEMANTICS.map((rule) => rule.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
    expect(subjects).toEqual(
      expect.arrayContaining([
        ...WORKFLOW_GRAPH_FIELDS.map((field) => `graph.${field}`),
        ...OFFICIAL_WORKFLOW_PRIMITIVES.map(
          (primitive) => `primitive.${primitive}`,
        ),
      ]),
    );
  });

  it("registers every accepted V2 field without enabling action retry", () => {
    expect(WORKFLOW_SCHEMA_FIELDS.graphV2).toEqual(
      expect.arrayContaining([
        "schemaVersion",
        "argsSchemaName",
        "returnSchemaName",
        "principalSchemaName",
        "policyPosture",
        "kickoffProfiles",
        "unstableArgs",
      ]),
    );
    expect(WORKFLOW_SCHEMA_FIELDS.nodeV2).toEqual(
      expect.arrayContaining([
        "stepName",
        "payloadPolicy",
        "semanticRuleIds",
        "failurePolicy",
        "functionKind",
        "schedule",
        "transaction",
        "eventDefinition",
        "workflow",
        "childVersion",
      ]),
    );
    expect(WORKFLOW_GRAPH_FIELDS).toEqual(
      expect.arrayContaining([
        "nodes[].retry.initialBackoffMs",
        "nodes[].failurePolicy.failure.code",
        "nodes[].transaction.limits.scheduledFunctionArgsBytes",
        "kickoffProfiles[].mode",
        "policyPosture.policyHash",
      ]),
    );

    for (const id of [
      "WF-NODE-RETRY",
      "WF-RETRY-MAX-ATTEMPTS",
      "WF-RETRY-INITIAL-BACKOFF",
      "WF-RETRY-BASE",
    ]) {
      expect(WORKFLOW_SEMANTICS.find((rule) => rule.id === id)?.status).toBe(
        "supported",
      );
    }
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-STEP-ACTION")?.status,
    ).toBe("intentionally-restricted");
  });

  it("keeps child workflows restricted until production closure lands", () => {
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-NODE-SUBWORKFLOW"),
    ).toMatchObject({
      status: "intentionally-restricted",
      fixture: "packages/convex/test/workflow-conformance.test.ts",
      reason: expect.stringMatching(
        /generator registry projection.*cycle.*depth.*fanout.*workflowRunLinks.*idempotent parent\/child linkage/,
      ),
      repair: expect.stringMatching(
        /builder.*compiler.*generator.*behavior fixtures/,
      ),
    });
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-NODE-CHILD-VERSION"),
    ).toMatchObject({
      status: "intentionally-restricted",
      reason: expect.stringMatching(/generated registry.*exact key\/version/),
      repair: expect.stringMatching(/generated projection.*reconciliation/),
    });
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-CHILD-SCHEDULE"),
    ).toMatchObject({
      status: "unsupported",
      repair: expect.stringMatching(/named sleep.*non-equivalent/),
    });
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-NODE-PAYLOAD-POLICY")
        ?.status,
    ).toBe("intentionally-restricted");
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-PAYLOAD-MAX-INPUT")
        ?.status,
    ).toBe("intentionally-restricted");
  });

  it("requires mappings and fixtures for support and repairs for every rule", () => {
    expect(validateWorkflowSemantics(WORKFLOW_SEMANTICS)).toEqual([]);
  });

  it("rejects a newly accepted graph field without semantic evidence", () => {
    const firstRule = WORKFLOW_SEMANTICS[0];
    if (firstRule === undefined) throw new Error("semantic ledger is empty");
    expect(
      validateWorkflowSemantics([
        ...WORKFLOW_SEMANTICS,
        {
          ...firstRule,
          id: "WF-GRAPH-UNMAPPED",
          subject: "graph.newAcceptedField",
          fixture: "",
          compilerMapping: "",
        },
      ]),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("WF-GRAPH-UNMAPPED")]),
    );
  });

  it("renders a stable generated Markdown projection", () => {
    const first = renderWorkflowSemanticsMarkdown(WORKFLOW_SEMANTICS);
    expect(renderWorkflowSemanticsMarkdown(WORKFLOW_SEMANTICS)).toBe(first);
    expect(first).toContain("WF-HANDLER-DATE");
    expect(first).toContain("intentionally-restricted");
  });

  it("validates typed generator coverage without claiming the global ledger", () => {
    expect(
      validateWorkflowSemanticCoverage({
        "WF-DEFINE": {
          posture: "generated",
          constructor: "defineMaestroWorkflow",
          compiler: "registered runner",
          fixture: "workflow-output-smoke.ts",
        },
        "WF-NODE-RETRY": {
          posture: "guarded-default",
          constructor: "WorkflowNode.retry",
          compiler: "maxAttempts=1/backoffMs=0",
          fixture: "index.test.ts",
        },
      }),
    ).toEqual([]);
    expect(
      validateWorkflowSemanticCoverage({
        "WF-NODE-RETRY": {
          posture: "generated",
          constructor: "WorkflowActionNodeV2.retry",
          compiler: "guarded retry",
          fixture: "workflow-conformance.test.ts",
        },
      }),
    ).toEqual([]);
  });
});
