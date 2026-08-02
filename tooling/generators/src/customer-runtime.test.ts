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
  CUSTOMER_COMMANDS,
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
  it("doctors the canonical versioned instance emitted by public create", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-doctor-"));
    const instancePath = join(cwd, "template-instance.json");
    const source = `${JSON.stringify(
      {
        schemaVersion: 1,
        release: {
          version: "0.2.0-alpha.1",
          tag: "maestro-template-v0.2.0-alpha.1",
          sourceCommit: "0123456789abcdef0123456789abcdef01234567",
          sourceChecksum: `sha256:${"a".repeat(64)}`,
        },
        compatibility: {
          cli: ">=0.1.0-alpha.1 <0.2.0",
          agentPack: ">=0.1.0-alpha.1 <0.2.0",
        },
        ownership: { manifest: "tagged-current-composition" },
        blueprint: { id: "saas-application" },
        personalization: {
          name: "Customer Doctor",
          firstOutcome: "Verify the generated instance",
          demoOnly: true,
        },
      },
      null,
      2,
    )}\n`;
    try {
      writeFileSync(instancePath, source);
      const result = runCustomerGeneratorCli(
        ["doctor", "--", "--mode", "fake"],
        cwd,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        mode: "fake",
        instancePath,
      });
      expect(readFileSync(instancePath, "utf8")).toBe(source);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it.each(CUSTOMER_COMMANDS)("publishes exact help for %s", (command) => {
    for (const flag of ["--help", "-h"]) {
      for (const argv of [
        [command, flag],
        [command, "--", flag],
      ]) {
        const result = runCustomerGeneratorCli(argv, repoRoot);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain(`template:${command}`);
      }
    }
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

  it("emits feature fixtures that satisfy the customer lint policy", () => {
    const preview = runCustomerGeneratorCli(
      [
        "add-feature",
        "--name",
        "customerReview",
        "--system",
        "knowledge-brain",
        "--disposition",
        "extend",
      ],
      repoRoot,
    );

    expect(preview.exitCode).toBe(0);
    const result = JSON.parse(preview.stdout) as {
      files: readonly { path: string; content: string }[];
    };
    const fixture = result.files.find(({ path }) =>
      path.endsWith("/fixtures.ts"),
    )?.content;
    expect(fixture).toContain(
      "export const fakeCustomerReviewItem: CustomerReviewItem",
    );
    expect(fixture).toContain("draft: fakeCustomerReviewItem");
    expect(fixture).toContain("item: fakeCustomerReviewItem");
    expect(fixture).not.toContain("[0]!");
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
      expect(reviewed.output.focusedGates).toContain(
        "pnpm check:system-catalog",
      );

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
            "pnpm format",
            "pnpm --dir apps/web build",
          ],
          focusedGates: expect.arrayContaining([
            "pnpm --dir apps/web typecheck",
          ]),
        },
      });
      if (!reviewed.ok) throw new Error(reviewed.message);
      expect(
        reviewed.output.files.find(({ path }) => path.endsWith("/fixtures.ts"))
          ?.content,
      ).not.toContain("[0]!");
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
