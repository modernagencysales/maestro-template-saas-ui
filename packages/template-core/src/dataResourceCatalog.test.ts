import { describe, expect, it } from "vitest";
import {
  parseDataResourceCatalog,
  renderDataResourceRuntime,
} from "./dataResourceCatalog";

const catalog = {
  schemaVersion: 1,
  resources: [
    {
      id: "brainPages",
      system: "knowledge-brain",
      sourcePath: "packages/convex/confect/tables/brainPages.ts",
      tenantScope: "workspace",
      sensitivity: "confidential",
      pii: ["customer-content"],
      exportMode: "markdown",
      deleteMode: "delete",
      retention: "retain-until-workspace-delete",
      appendOnly: false,
      writePosture: "implemented",
      workspaceLifecycle: "managed",
      writeAuthority: "packages/convex/confect/brain",
      migrationRef: "docs/template/data-lifecycle.md#current-resources",
      detail: "Source-backed pages follow the workspace lifecycle.",
    },
  ],
};

describe("data resource catalog", () => {
  it("parses complete durable-resource metadata", () => {
    const parsed = parseDataResourceCatalog(catalog);

    expect(parsed.resources[0]).toMatchObject({
      id: "brainPages",
      system: "knowledge-brain",
      tenantScope: "workspace",
      workspaceLifecycle: "managed",
    });
  });

  it("renders the canonical managed lifecycle projection", () => {
    const source = renderDataResourceRuntime(parseDataResourceCatalog(catalog));

    expect(source).toContain(
      'export const currentLifecycleResourceIds = [\n  "brainPages"\n] as const;',
    );
    expect(source).toContain('exportMode: "markdown"');
    expect(source).toContain('action: "retain-until-workspace-delete"');
  });

  it.each([
    [null, "data resource catalog must be an object"],
    [
      { ...catalog, schemaVersion: 2 },
      "invalid data resource catalog schema version",
    ],
    [
      { ...catalog, resources: [] },
      "data resource catalog must contain resources",
    ],
    [
      { ...catalog, resources: [catalog.resources[0], catalog.resources[0]] },
      "duplicate data resource ids",
    ],
    [
      {
        ...catalog,
        resources: [
          {
            ...catalog.resources[0],
            workspaceLifecycle: "managed",
            tenantScope: "global",
          },
        ],
      },
      "managed workspace lifecycle requires workspace tenant scope",
    ],
    [
      {
        ...catalog,
        resources: [
          {
            ...catalog.resources[0],
            retention: "retain-until-account-delete",
          },
        ],
      },
      "managed workspace resource must use a workspace retention action",
    ],
    [
      {
        ...catalog,
        resources: [{ ...catalog.resources[0], writePosture: "planned" }],
      },
      "invalid data write posture",
    ],
  ])("rejects malformed resource contracts: %#", (value, message) => {
    expect(() => parseDataResourceCatalog(value)).toThrow(message);
  });
});
