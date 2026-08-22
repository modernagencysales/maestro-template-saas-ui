import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDataResourceCatalog } from "@maestro-template/template-core/dataResourceCatalog";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";
import { describe, expect, it } from "vitest";
import {
  checkDataResources,
  renderDataResourceRuntime,
  validateDataResources,
  type DataResourceFileSystem,
} from "./check-data-resources.mts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const systems = parseSystemCatalog(
  JSON.parse(
    readFileSync(resolve(ROOT, "docs/template/system-catalog.json"), "utf8"),
  ) as unknown,
);
const resources = parseDataResourceCatalog(
  JSON.parse(
    readFileSync(resolve(ROOT, "docs/template/data-resources.json"), "utf8"),
  ) as unknown,
);

const fakeFileSystem = (options?: {
  readonly tables?: readonly string[];
  readonly missing?: readonly string[];
  readonly runtime?: string;
}): DataResourceFileSystem => {
  const missing = new Set(options?.missing ?? []);
  return {
    exists: (path) => !missing.has(path),
    isFile: (path) => !missing.has(path),
    tableNames: () =>
      options?.tables ?? resources.resources.map(({ id }) => id),
    runtimeSource: () =>
      options?.runtime ?? renderDataResourceRuntime(resources),
  };
};

describe("check:data-resources", () => {
  it("keeps every table, system owner, lifecycle contract, and runtime projection aligned", () => {
    expect(checkDataResources(ROOT)).toEqual([]);
  });

  it("blocks a table without lifecycle metadata", () => {
    const findings = validateDataResources(
      systems,
      resources,
      fakeFileSystem({
        tables: [...resources.resources.map(({ id }) => id), "shadowProfiles"],
      }),
    );

    expect(findings).toContainEqual({
      subject: "shadowProfiles",
      issue: "schema table has no durable data-resource contract",
    });
  });

  it("blocks owner drift and missing authority or migration references", () => {
    const first = resources.resources[0];
    if (first === undefined) throw new Error("expected fixture resource");
    const changed = {
      ...resources,
      resources: [
        {
          ...first,
          system: "notifications",
          writeAuthority: "packages/convex/confect/missing",
          migrationRef: "docs/template/schema-decisions/missing.md",
        },
        ...resources.resources.slice(1),
      ],
    };
    const findings = validateDataResources(
      systems,
      changed,
      fakeFileSystem({
        missing: [
          "packages/convex/confect/missing",
          "docs/template/schema-decisions/missing.md",
        ],
        runtime: renderDataResourceRuntime(changed),
      }),
    );

    expect(findings.map(({ issue }) => issue)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("system owner does not match"),
        expect.stringContaining("write authority does not exist"),
        expect.stringContaining("migration reference does not exist"),
      ]),
    );
  });

  it("blocks stale generated runtime lifecycle definitions", () => {
    const findings = validateDataResources(
      systems,
      resources,
      fakeFileSystem({ runtime: "export const stale = true;\n" }),
    );

    expect(findings).toContainEqual({
      subject: "packages/convex/confect/ops/dataResources.generated.ts",
      issue:
        "generated data-resource runtime is stale; run pnpm data-resources:generate",
    });
  });

  it("fails closed when write posture and authority boundary disagree", () => {
    const first = resources.resources[0];
    if (first === undefined) throw new Error("expected fixture resource");
    const unavailable = {
      ...resources,
      resources: [
        {
          ...first,
          writePosture: "external-unavailable" as const,
          writeAuthority: "packages/convex/confect/brain",
        },
        ...resources.resources.slice(1),
      ],
    };
    const implementedDoc = {
      ...resources,
      resources: [
        {
          ...first,
          writePosture: "implemented" as const,
          writeAuthority: "docs/template/system-decisions/knowledge-brain.md",
        },
        ...resources.resources.slice(1),
      ],
    };

    expect(
      validateDataResources(
        systems,
        unavailable,
        fakeFileSystem({ runtime: renderDataResourceRuntime(unavailable) }),
      ).map(({ issue }) => issue),
    ).toContain(
      "external-unavailable write posture must point to docs/template/system-decisions/access-and-tenancy.md",
    );
    expect(
      validateDataResources(
        systems,
        implementedDoc,
        fakeFileSystem({ runtime: renderDataResourceRuntime(implementedDoc) }),
      ).map(({ issue }) => issue),
    ).toContain(
      "implemented write posture must point to shipped code authority",
    );
  });
});
