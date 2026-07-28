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
import {
  runCustomerGeneratorCli,
  runReviewedGenerator,
} from "./customer-dispatcher";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const seedCatalogs = (cwd: string): void => {
  mkdirSync(join(cwd, "docs/template"), { recursive: true });
  for (const name of [
    "system-catalog.json",
    "data-resources.json",
    "product-topology.json",
  ]) {
    writeFileSync(
      join(cwd, "docs/template", name),
      readFileSync(join(repoRoot, "docs/template", name)),
    );
  }
};

describe("customer generator runtime", () => {
  it("normalizes the pnpm argument separator before dispatch", () => {
    const result = runCustomerGeneratorCli(
      ["--", "systems", "--query", "workflows"],
      repoRoot,
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "workflow-runtime" }),
      ]),
    );
  });

  it.each([
    ["add-capability", "customerReview"],
    ["add-workflow", "customerReviewFlow"],
  ])("previews and writes %s with identical bytes", (command, name) => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-runtime-"));
    try {
      const argv = [
        command,
        "--name",
        name,
        "--system",
        "knowledge-brain",
        "--disposition",
        "extend",
      ];
      const preview = runCustomerGeneratorCli(argv, cwd);
      expect(preview.exitCode).toBe(0);
      const result = JSON.parse(preview.stdout) as {
        files: readonly { path: string; content: string }[];
      };
      for (const file of result.files)
        expect(() => readFileSync(join(cwd, file.path))).toThrow();
      expect(runCustomerGeneratorCli([...argv, "--write"], cwd).exitCode).toBe(
        0,
      );
      for (const file of result.files)
        expect(readFileSync(join(cwd, file.path), "utf8")).toBe(file.content);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("previews and writes an add-table lifecycle slice", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-table-"));
    try {
      seedCatalogs(cwd);
      const argv = [
        "add-table",
        "--name",
        "customerNotes",
        "--system",
        "knowledge-brain",
        "--disposition",
        "extend",
        "--tenant-scope",
        "workspace",
        "--sensitivity",
        "confidential",
        "--pii",
        "none",
        "--export-mode",
        "json",
        "--delete-mode",
        "delete",
        "--retention",
        "retain-until-workspace-delete",
      ];
      const preview = runCustomerGeneratorCli(argv, cwd);
      expect(preview.exitCode).toBe(0);
      const result = JSON.parse(preview.stdout) as {
        files: readonly { path: string; content: string }[];
      };
      expect(runCustomerGeneratorCli([...argv, "--write"], cwd).exitCode).toBe(
        0,
      );
      for (const file of result.files)
        expect(readFileSync(join(cwd, file.path), "utf8")).toBe(file.content);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("updates reviewed table registries while preserving leaf collisions", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-table-review-"));
    try {
      seedCatalogs(cwd);
      const generatedRegistry = join(
        cwd,
        "packages/convex/confect/ops/dataResources.generated.ts",
      );
      mkdirSync(dirname(generatedRegistry), { recursive: true });
      writeFileSync(generatedRegistry, "export const existing = true;\n");
      const request = {
        generatorId: "add-table",
        args: {
          name: "customerNotes",
          system: "knowledge-brain",
          disposition: "extend",
          tenantScope: "workspace",
          sensitivity: "confidential",
          pii: "none",
          exportMode: "json",
          deleteMode: "delete",
          retention: "retain-until-workspace-delete",
          appendOnly: false,
        },
        write: false,
        cwd,
      } as const;

      const reviewed = runReviewedGenerator(request);
      expect(reviewed).toMatchObject({ ok: true });
      if (!reviewed.ok) throw new Error(reviewed.message);
      expect(reviewed.output.files.map(({ path }) => path)).toContain(
        "packages/convex/confect/ops/dataResources.generated.ts",
      );
      expect(reviewed.output.collisions).toEqual([]);

      const occupiedLeaf = join(
        cwd,
        "packages/convex/confect/tables/customerNotes.ts",
      );
      mkdirSync(dirname(occupiedLeaf), { recursive: true });
      writeFileSync(occupiedLeaf, "// customer-owned\n");
      const collided = runReviewedGenerator(request);
      expect(collided).toMatchObject({ ok: true });
      if (!collided.ok) throw new Error(collided.message);
      expect(collided.output.collisions).toEqual([
        "packages/convex/confect/tables/customerNotes.ts",
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("generates a feature route before running its typecheck gate", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-feature-review-"));
    try {
      seedCatalogs(cwd);
      const reviewed = runReviewedGenerator({
        generatorId: "add-feature",
        args: {
          name: "customerNotes",
          system: "knowledge-brain",
          disposition: "extend",
        },
        write: false,
        cwd,
      });

      expect(reviewed).toMatchObject({
        ok: true,
        output: {
          codegen: [
            "pnpm confect:codegen",
            "pnpm confect:manifest",
            "pnpm --dir apps/web build",
          ],
          focusedGates: expect.arrayContaining([
            "pnpm --dir apps/web typecheck",
          ]),
        },
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("runs the safe smoke command", () => {
    const result = runCustomerGeneratorCli(["smoke"], repoRoot);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
  });
});
