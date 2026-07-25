import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTemplateQuickstart, runGeneratorCli } from "../index";
import {
  buildSaasApplicationFiles,
  saasApplicationBlueprint,
} from "./saasApplication";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("saas application blueprint", () => {
  it("defines a neutral workflow-optional application contract", () => {
    expect(saasApplicationBlueprint).toMatchObject({
      id: "saas-application",
      defaultWorkflow: null,
      defaultAgent: null,
      providerPosture: "fake-first",
      entity: "record",
      automation: { status: "unavailable" },
    });
    expect(saasApplicationBlueprint.mandatorySystems).toEqual([
      "workspace tenancy",
      "table CRUD",
      "web route",
      "headless registry",
    ]);
    expect(JSON.stringify(saasApplicationBlueprint)).not.toMatch(
      /gtm|agency|customer-specific|plugin|mcp server/i,
    );
  });

  it("emits deterministic workspace-safe CRUD and readiness contracts", () => {
    const first = buildSaasApplicationFiles({ name: "My App" });
    const second = buildSaasApplicationFiles({ name: "My App" });
    expect(first).toEqual(second);
    expect(first.map(({ path }) => path)).toEqual([
      "examples/saas-application/seed/workspace.json",
      "examples/saas-application/seed/records.json",
      "examples/saas-application/seed/source.json",
      "examples/saas-application/seed/crud-scenario.json",
      "generated/blueprints/saas-application/application-contract.json",
      "generated/blueprints/saas-application/surface-contract.json",
      "generated/blueprints/saas-application/readiness.json",
    ]);
    for (const file of first.slice(0, 4)) {
      expect(readFileSync(join(repoRoot, file.path), "utf8")).toBe(
        file.content,
      );
    }

    const contract = JSON.parse(first[4]?.content ?? "{}");
    expect(contract).toMatchObject({
      entity: {
        singular: "record",
        renameable: true,
        tenantKey: "workspaceId",
      },
      primitive: "table-route-crud",
      workflowRequired: false,
      operations: [
        { id: "records.list", kind: "query" },
        { id: "records.read", kind: "query" },
        { id: "records.create", kind: "mutation" },
      ],
      uiStates: ["loading", "empty", "error", "list", "detail", "create"],
    });
    expect(
      contract.operations.every(
        (operation: { workspaceScoped: boolean }) => operation.workspaceScoped,
      ),
    ).toBe(true);

    const surfaces = JSON.parse(first[5]?.content ?? "{}");
    expect(surfaces.web.operations).toEqual(surfaces.headless.operations);
    expect(surfaces.providers.fake).toMatchObject({
      status: "fake",
      behavior: "in-memory workspace-scoped CRUD",
    });
    expect(surfaces.providers.local).toMatchObject({
      status: "seam",
      placeholderSuccess: false,
    });

    const readiness = JSON.parse(first[6]?.content ?? "{}");
    expect(
      readiness.surfaces.every((surface: { status: string }) =>
        ["real", "fake", "seam", "unavailable"].includes(surface.status),
      ),
    ).toBe(true);
    expect(readiness.automation).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("semantic ledger"),
    });
  });

  it("enumerates every dry-run target and collision without mutation", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-saas-blueprint-"));
    try {
      const initial = runGeneratorCli(
        ["quickstart", "--blueprint", "saas-application", "--name", "My App"],
        cwd,
      );
      expect(initial.exitCode).toBe(0);
      const preview = JSON.parse(initial.stdout);
      expect(preview.targets).toEqual(
        preview.files.map((file: { path: string }) => file.path),
      );
      expect(preview.collisions).toEqual([]);

      const occupied = preview.targets[4] as string;
      const occupiedPath = join(cwd, occupied);
      mkdirSync(dirname(occupiedPath), { recursive: true });
      writeFileSync(occupiedPath, "owned\n");
      const collided = JSON.parse(
        runGeneratorCli(
          ["quickstart", "--blueprint", "saas-application", "--name", "My App"],
          cwd,
        ).stdout,
      );
      expect(collided.collisions).toEqual([occupied]);
      const refused = runGeneratorCli(
        [
          "quickstart",
          "--blueprint",
          "saas-application",
          "--name",
          "My App",
          "--write",
        ],
        cwd,
      );
      expect(refused).toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining("Refusing to overwrite"),
      });
      expect(readFileSync(occupiedPath, "utf8")).toBe("owned\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("keeps legacy IDs stable and omits mandatory automation/provider products", () => {
    const quickstart = buildTemplateQuickstart({
      blueprint: "saas-application",
      name: "My App",
      generatedAt: "2026-07-25T00:00:00.000Z",
    });
    expect(quickstart).toMatchObject({
      blueprint: "saas-application",
      firstCapability: null,
      firstWorkflow: null,
      firstAgent: null,
    });
    expect(quickstart.instance.modules).toEqual([
      "workspace",
      "records",
      "web",
      "api",
      "cli",
    ]);
    expect(quickstart.nextCommands).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/workflow|agent|mcp|provider/i),
      ]),
    );
  });
});
