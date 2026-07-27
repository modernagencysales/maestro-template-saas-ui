import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkWorkflowSemantics,
  readWorkflowGraphFields,
  writeWorkflowSemanticsDoc,
} from "./check-workflow-semantics.mts";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("check:workflow-semantics", () => {
  it("derives the complete typed graph field inventory", () => {
    const fields = readWorkflowGraphFields();
    expect(new Set(fields).size).toBe(fields.length);
    expect(fields).toEqual(
      expect.arrayContaining([
        "nodes[].retry.maxAttempts",
        "nodes[].retry.initialBackoffMs",
        "nodes[].failurePolicy.failure.code",
        "nodes[].transaction.limits.scheduledFunctionArgsBytes",
        "kickoffProfiles[].mode",
        "policyPosture.policyHash",
      ]),
    );
  });

  it("passes the repository ledger and generated projection", () => {
    expect(checkWorkflowSemantics(repoRoot)).toEqual([]);
  });

  it("finds missing and stale projections, writes one, then passes", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "workflow-semantics-"));
    const generatedDir = join(tempRoot, "docs/template/generated");
    const generatedDoc = join(generatedDir, "workflow-semantics.md");
    try {
      expect(checkWorkflowSemantics(tempRoot)).toEqual([
        expect.objectContaining({ ruleId: "WF-DOC-PROJECTION" }),
      ]);

      mkdirSync(generatedDir, { recursive: true });
      writeFileSync(generatedDoc, "stale\n");
      expect(checkWorkflowSemantics(tempRoot)).toEqual([
        expect.objectContaining({ ruleId: "WF-DOC-PROJECTION" }),
      ]);

      writeWorkflowSemanticsDoc(tempRoot);
      expect(checkWorkflowSemantics(tempRoot)).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
