import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSystemCatalog,
  type SystemCatalog,
} from "@maestro-template/template-core/systemCatalog";
import { describe, expect, it } from "vitest";
import {
  checkSystemCatalog,
  validateSystemCatalog,
  type SystemCatalogFileSystem,
} from "./check-system-catalog.mts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CATALOG = parseSystemCatalog(
  JSON.parse(
    readFileSync(resolve(ROOT, "docs/template/system-catalog.json"), "utf8"),
  ) as unknown,
);

const fakeFileSystem = (options?: {
  readonly tables?: readonly string[];
  readonly missing?: readonly string[];
}): SystemCatalogFileSystem => {
  const missing = new Set(options?.missing ?? []);
  return {
    exists: (path) => !missing.has(path),
    isFile: (path) => !missing.has(path),
    tableNames: () =>
      options?.tables ?? CATALOG.systems.flatMap((system) => system.tables),
  };
};

const replaceSystem = (
  catalog: SystemCatalog,
  id: string,
  change: Partial<SystemCatalog["systems"][number]>,
): SystemCatalog => ({
  ...catalog,
  systems: catalog.systems.map((system) =>
    system.id === id ? { ...system, ...change } : system,
  ),
});

describe("check:system-catalog", () => {
  it("covers every current hand-authored table and resolves every canonical path", () => {
    expect(checkSystemCatalog(ROOT)).toEqual([]);
  });

  it("blocks an unowned schema table", () => {
    const findings = validateSystemCatalog(
      CATALOG,
      fakeFileSystem({
        tables: [
          ...CATALOG.systems.flatMap((system) => system.tables),
          "parallelWorkflowRuns",
        ],
      }),
    );

    expect(findings).toContainEqual({
      subject: "parallelWorkflowRuns",
      issue:
        "schema table has no canonical system owner; extend an existing system or record an introduction decision",
    });
  });

  it("blocks stale table ownership and missing entrypoints or decisions", () => {
    const staleCatalog = replaceSystem(CATALOG, "workflow-runtime", {
      tables: [
        ...(CATALOG.systems.find((system) => system.id === "workflow-runtime")
          ?.tables ?? []),
        "ghostRuns",
      ],
    });
    const findings = validateSystemCatalog(
      staleCatalog,
      fakeFileSystem({
        missing: [
          "packages/convex/confect/workflows",
          "docs/template/system-catalog.md",
        ],
      }),
    );

    expect(findings.map((finding) => finding.issue)).toEqual(
      expect.arrayContaining([
        "catalog owns a table that has no hand-authored Confect table file",
        "canonical entrypoint does not exist: packages/convex/confect/workflows",
        expect.stringContaining("system decision does not resolve to a file"),
      ]),
    );
  });

  it("blocks retired systems retaining active persistence", () => {
    const retired = replaceSystem(CATALOG, "notifications", {
      lifecycle: "retired",
    });

    expect(validateSystemCatalog(retired, fakeFileSystem())).toContainEqual({
      subject: "notifications",
      issue: "retired systems must not own active schema tables",
    });
  });
});
