import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProductTopology } from "@maestro-template/template-core/productTopology";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";
import { describe, expect, it } from "vitest";
import {
  checkSystemTopology,
  validateSystemTopology,
  type ProductTopologyFileSystem,
} from "./check-system-topology.mts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const systems = parseSystemCatalog(
  JSON.parse(
    readFileSync(resolve(ROOT, "docs/template/system-catalog.json"), "utf8"),
  ) as unknown,
);
const topology = parseProductTopology(
  JSON.parse(
    readFileSync(resolve(ROOT, "docs/template/product-topology.json"), "utf8"),
  ) as unknown,
);

const fakeFileSystem = (options?: {
  readonly discovered?: readonly string[];
  readonly missing?: readonly string[];
  readonly generated?: readonly {
    readonly path: string;
    readonly system: string;
    readonly disposition: "reuse" | "extend";
  }[];
}): ProductTopologyFileSystem => {
  const missing = new Set(options?.missing ?? []);
  return {
    exists: (path) => !missing.has(path),
    discoveredPaths: () =>
      options?.discovered ?? topology.resources.map(({ path }) => path),
    generatedOwnership: () => options?.generated ?? [],
  };
};

describe("check:system-topology", () => {
  it("owns every discovered production resource", () => {
    expect(checkSystemTopology(ROOT)).toEqual([]);
  });

  it("blocks an unowned production capability", () => {
    const findings = validateSystemTopology(
      systems,
      topology,
      fakeFileSystem({
        discovered: [
          ...topology.resources.map(({ path }) => path),
          "packages/convex/confect/capabilities/parallelMemory.spec.ts",
        ],
      }),
    );

    expect(findings).toContainEqual({
      subject: "packages/convex/confect/capabilities/parallelMemory.spec.ts",
      issue:
        "production resource has no canonical owner or generated ownership provenance",
    });
  });

  it("accepts generated production resources with canonical ownership", () => {
    const path = "packages/convex/confect/capabilities/newBrief.spec.ts";
    const findings = validateSystemTopology(
      systems,
      topology,
      fakeFileSystem({
        discovered: [...topology.resources.map(({ path }) => path), path],
        generated: [{ path, system: "knowledge-brain", disposition: "extend" }],
      }),
    );

    expect(findings).toEqual([]);
  });

  it("blocks unknown generated owners and stale topology paths", () => {
    const stale = topology.resources[0];
    if (stale === undefined) throw new Error("expected topology fixture");
    const findings = validateSystemTopology(
      systems,
      topology,
      fakeFileSystem({
        missing: [stale.path],
        generated: [
          {
            path: "packages/convex/confect/agents/shadow.spec.ts",
            system: "shadow-system",
            disposition: "extend",
          },
        ],
      }),
    );

    expect(findings.map(({ issue }) => issue)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("registered topology path does not exist"),
        expect.stringContaining("unknown canonical system"),
      ]),
    );
  });
});
