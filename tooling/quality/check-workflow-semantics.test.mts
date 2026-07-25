import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkWorkflowSemantics,
  readWorkflowGraphFields,
} from "./check-workflow-semantics.mts";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("check:workflow-semantics", () => {
  it("derives the complete typed graph field inventory", () => {
    expect(readWorkflowGraphFields(repoRoot)).toHaveLength(23);
    expect(readWorkflowGraphFields(repoRoot)).toContain(
      "nodes[].retry.maxAttempts",
    );
  });

  it("passes the repository ledger and generated projection", () => {
    expect(checkWorkflowSemantics(repoRoot)).toEqual([]);
  });
});
