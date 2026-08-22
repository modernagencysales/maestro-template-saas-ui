import { describe, expect, it } from "vitest";

import { buildAppMap, renderAppMapSummary, serializeAppMap } from "./build";
import type { AppMapBuildInputV1 } from "./schema";
import { readFixture } from "./test-fixtures";

const reverseFacts = (input: AppMapBuildInputV1): AppMapBuildInputV1 => ({
  ...input,
  batches: [...input.batches].reverse().map((batch) => ({
    ...batch,
    nodes: [...batch.nodes].reverse(),
    edges: [...batch.edges].reverse(),
  })),
});

describe("deterministic App Map build", () => {
  it("builds provenance-complete facts in the four human groups", () => {
    const result = buildAppMap(readFixture("valid"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.map.groups).toEqual([
      { name: "Screens", nodeIds: ["route:/knowledge"] },
      { name: "Data", nodeIds: ["table:brainPages"] },
      {
        name: "Automations",
        nodeIds: ["workflow:source-grounded-brief@1"],
      },
      {
        name: "Connections",
        nodeIds: [
          "system:access-and-tenancy",
          "system:knowledge-brain",
          "system:workflow-runtime",
        ],
      },
    ]);
    expect(
      [...result.map.nodes, ...result.map.edges].every(
        (fact) => fact.provenance.authority === "canonical",
      ),
    ).toBe(true);
    expect(renderAppMapSummary(result.map)).toContain("Screens (1)");
    expect(renderAppMapSummary(result.map)).toContain(
      "Next action: no ownership repairs required.",
    );
  });

  it("produces identical bytes when adapters and facts arrive reordered", () => {
    const input = readFixture("valid");
    const first = buildAppMap(input);
    const second = buildAppMap(reverseFacts(input));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.json).toBe(second.json);
    expect(first.json).toBe(serializeAppMap(first.map));
    expect(first.json.endsWith("\n")).toBe(true);
  });

  it("builds fresh normalized output without mutating canonical input", () => {
    const input = readFixture("valid");
    const before = JSON.stringify(input);
    const first = buildAppMap(input);
    const second = buildAppMap(input);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.json).toBe(second.json);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.map.subject).not.toBe(input.subject);
    expect(first.map.sources[0]).not.toBe(input.batches[0]?.source);
  });
});
