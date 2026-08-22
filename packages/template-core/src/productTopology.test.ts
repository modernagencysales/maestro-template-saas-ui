import { describe, expect, it } from "vitest";
import { parseProductTopology } from "./productTopology";

const topology = {
  schemaVersion: 1,
  resources: [
    {
      id: "capability:source-grounded-brief",
      kind: "capability",
      system: "knowledge-brain",
      path: "packages/convex/confect/capabilities/sourceGroundedBrief.spec.ts",
      responsibility: "create a source-grounded implementation brief",
      surfaces: ["web", "api", "cli", "mcp"],
      uses: ["access-and-tenancy", "policy-and-prompts"],
      lifecycle: "active",
    },
  ],
};

describe("product topology", () => {
  it("parses canonical production-resource ownership", () => {
    expect(parseProductTopology(topology).resources[0]).toMatchObject({
      id: "capability:source-grounded-brief",
      kind: "capability",
      system: "knowledge-brain",
    });
  });

  it.each([
    [null, "product topology must be an object"],
    [
      { ...topology, schemaVersion: 2 },
      "invalid product topology schema version",
    ],
    [{ ...topology, resources: [] }, "product topology must contain resources"],
    [
      {
        ...topology,
        resources: [topology.resources[0], topology.resources[0]],
      },
      "duplicate product resource ids",
    ],
    [
      {
        ...topology,
        resources: [
          topology.resources[0],
          {
            ...topology.resources[0],
            id: "route:brief",
            responsibility: "show briefs",
          },
        ],
      },
      "duplicate product resource paths",
    ],
  ])("rejects malformed topology: %#", (value, message) => {
    expect(() => parseProductTopology(value)).toThrow(message);
  });
});
