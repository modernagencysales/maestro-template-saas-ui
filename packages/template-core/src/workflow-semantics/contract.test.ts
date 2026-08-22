import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
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
import { WorkflowSemanticStatus } from "./schema";

describe("workflow semantics contract", () => {
  it("decodes every persisted semantic status and rejects unknown values", () => {
    const decode = Schema.decodeUnknownExit(WorkflowSemanticStatus);

    for (const status of [
      "supported",
      "intentionally-restricted",
      "unsupported",
    ]) {
      const decoded = decode(status);
      expect(Exit.isSuccess(decoded)).toBe(true);
      if (Exit.isSuccess(decoded)) {
        expect(decoded.value).toBe(status);
      }
    }

    expect(Exit.isFailure(decode("unknown"))).toBe(true);
  });

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
        "nodes[].failurePolicy.steps[].capability",
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
    ).toBe("supported");
  });

  it("keeps child lifecycle restricted while publishing exact child versions", () => {
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-NODE-SUBWORKFLOW"),
    ).toMatchObject({
      status: "intentionally-restricted",
      fixture: "packages/convex/test/workflow-conformance.test.ts",
      reason: expect.stringMatching(
        /publication binding.*cycle.*depth.*fan-out.*authority.*payload.*product-run linkage/,
      ),
      repair: expect.stringMatching(
        /cancellation.*cleanup.*lifecycle controls.*quiescence.*retention/,
      ),
    });
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-NODE-CHILD-VERSION"),
    ).toMatchObject({
      status: "supported",
      compilerMapping: expect.stringMatching(
        /published graph snapshot.*runner.*mapper.*result schema.*lifecycle contract.*workflowRunLinks/,
      ),
      runtimeGuard: expect.stringMatching(
        /forged graph snapshot.*mapper\/schema identity drift.*dependency checksum drift/,
      ),
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

  it("fails Workpool production safety closed on behavioral evidence", () => {
    for (const id of [
      "WF-WORKPOOL-DUPLICATE-COMPLETION",
      "WF-WORKPOOL-CANCEL-RACE",
    ]) {
      expect(WORKFLOW_SEMANTICS.find((rule) => rule.id === id)).toMatchObject({
        status: "unsupported",
        fixture: "tooling/convex-compat/src/candidate-install.test.ts",
        repair: expect.stringMatching(/disabled|workflow-optional/),
      });
    }
  });

  it("publishes only the proven terminal typed-event semantics", () => {
    for (const id of [
      "WF-NODE-EVENT-DEFINITION",
      "WF-NODE-EVENT-SCHEMA",
      "WF-NODE-EVENT-INSTANCE",
    ]) {
      expect(WORKFLOW_SEMANTICS.find((rule) => rule.id === id)).toMatchObject({
        status: "supported",
        fixture: "packages/convex/test/workflow-conformance.test.ts",
      });
    }
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-STEP-EVENT"),
    ).toMatchObject({
      status: "supported",
      compilerMapping: expect.stringMatching(
        /ID-bound generated event definition.*shared validator.*persisted consumed reconciliation/,
      ),
    });
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-SEND-EVENT"),
    ).toMatchObject({
      status: "supported",
      compilerMapping: expect.stringMatching(
        /authenticated generated selector translation.*component-owned EventId/,
      ),
    });
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-CREATE-EVENT"),
    ).toMatchObject({
      status: "intentionally-restricted",
      reason: expect.stringMatching(/internal to persisted generation/),
    });
  });

  it("publishes only guarded inline transaction semantics", () => {
    const transactionRuleIds = [
      "WF-NODE-TRANSACTION",
      "WF-TRANSACTION-KIND",
      "WF-TRANSACTION-LIMITS",
      "WF-TRANSACTION-BYTES-READ",
      "WF-TRANSACTION-BYTES-WRITTEN",
      "WF-TRANSACTION-DATABASE-QUERIES",
      "WF-TRANSACTION-DOCUMENTS-READ",
      "WF-TRANSACTION-DOCUMENTS-WRITTEN",
      "WF-TRANSACTION-FUNCTIONS-SCHEDULED",
      "WF-TRANSACTION-SCHEDULED-FUNCTION-ARGS-BYTES",
    ] as const;
    for (const id of transactionRuleIds) {
      expect(WORKFLOW_SEMANTICS.find((rule) => rule.id === id)).toMatchObject({
        status: "supported",
        runtimeGuard: expect.stringMatching(
          /independent remains default.*query\/mutation capability only.*small-atomic.*named presets or reviewed explicit positive counters.*action, scheduled, and other node combinations.*canonical JSON\/runtime parity.*Convex 1\.42\.1/,
        ),
      });
    }
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-NODE-SCHEDULE")?.status,
    ).toBe("intentionally-restricted");
    expect(
      WORKFLOW_SEMANTICS.find((rule) => rule.id === "WF-STEP-ACTION")?.status,
    ).toBe("supported");
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
