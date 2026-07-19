import { describe, expect, it } from "vitest";
import {
  canonicalSystemById,
  findCanonicalSystems,
  parseSystemCatalog,
} from "./systemCatalog";

const catalog = {
  schemaVersion: 1,
  systems: [
    {
      id: "knowledge-brain",
      name: "Knowledge Brain",
      kind: "product-system",
      lifecycle: "active",
      implementationStatus: "real",
      summary: "Owns source-backed knowledge.",
      responsibilities: ["curate durable knowledge"],
      aliases: ["knowledge", "rag"],
      tables: ["brainPages"],
      canonicalEntrypoints: ["packages/convex/confect/brain"],
      decisionRef: "docs/template/system-catalog.md#knowledge-brain",
    },
  ],
};

describe("system catalog", () => {
  it("parses a closed catalog and resolves exact aliases and tables", () => {
    const parsed = parseSystemCatalog(catalog);

    expect(canonicalSystemById(parsed, "knowledge-brain").tables).toEqual([
      "brainPages",
    ]);
    expect(
      findCanonicalSystems(parsed, "rag").map((system) => system.id),
    ).toEqual(["knowledge-brain"]);
    expect(findCanonicalSystems(parsed, "brainPages")).toHaveLength(1);
    expect(findCanonicalSystems(parsed, "unrelated")).toEqual([]);
  });

  it.each([
    [null, "system catalog must be an object"],
    [{ ...catalog, schemaVersion: 2 }, "invalid system catalog schema version"],
    [{ ...catalog, systems: [] }, "system catalog must contain systems"],
    [
      { ...catalog, systems: [catalog.systems[0], catalog.systems[0]] },
      "duplicate system ids",
    ],
    [
      {
        ...catalog,
        systems: [
          catalog.systems[0],
          {
            ...catalog.systems[0],
            id: "search",
            name: "Search",
            aliases: ["rag"],
            tables: ["searchDocuments"],
            responsibilities: ["search knowledge"],
          },
        ],
      },
      "system lookup",
    ],
    [
      {
        ...catalog,
        systems: [
          catalog.systems[0],
          {
            ...catalog.systems[0],
            id: "search",
            name: "Search",
            aliases: ["search"],
            responsibilities: ["search knowledge"],
          },
        ],
      },
      "duplicate table ownership",
    ],
  ])("rejects malformed or multiply-owned catalogs: %#", (value, message) => {
    expect(() => parseSystemCatalog(value)).toThrow(message);
  });

  it("requires callers to use a canonical ID", () => {
    const parsed = parseSystemCatalog(catalog);

    expect(() => canonicalSystemById(parsed, "rag")).toThrow(
      "Unknown canonical system",
    );
  });
});
