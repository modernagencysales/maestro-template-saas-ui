import { describe, expect, it } from "vitest";
import {
  OFFICIAL_WORKFLOW_PRIMITIVES,
  WORKFLOW_GRAPH_FIELDS,
  WORKFLOW_SEMANTICS,
  renderWorkflowSemanticsMarkdown,
  validateWorkflowSemantics,
} from "./contract";

describe("workflow semantics contract", () => {
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
});
