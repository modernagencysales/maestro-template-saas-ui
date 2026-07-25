import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCustomerGeneratorCli } from "./customer-dispatcher";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const seedCatalogs = (cwd: string): void => {
  mkdirSync(join(cwd, "docs/template"), { recursive: true });
  for (const name of ["system-catalog.json", "data-resources.json", "product-topology.json"]) {
    writeFileSync(join(cwd, "docs/template", name), readFileSync(join(repoRoot, "docs/template", name)));
  }
};

describe("customer generator runtime", () => {
  it.each([["add-capability", "customerReview"], ["add-workflow", "customerReviewFlow"]])(
    "previews and writes %s with identical bytes",
    (command, name) => {
      const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-runtime-"));
      try {
        const argv = [command, "--name", name, "--system", "knowledge-brain", "--disposition", "extend"];
        const preview = runCustomerGeneratorCli(argv, cwd);
        expect(preview.exitCode).toBe(0);
        const result = JSON.parse(preview.stdout) as { files: readonly { path: string; content: string }[] };
        for (const file of result.files) expect(() => readFileSync(join(cwd, file.path))).toThrow();
        expect(runCustomerGeneratorCli([...argv, "--write"], cwd).exitCode).toBe(0);
        for (const file of result.files) expect(readFileSync(join(cwd, file.path), "utf8")).toBe(file.content);
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    },
  );

  it("previews and writes an add-table lifecycle slice", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-table-"));
    try {
      seedCatalogs(cwd);
      const argv = ["add-table", "--name", "customerNotes", "--system", "knowledge-brain", "--disposition", "extend", "--tenant-scope", "workspace", "--sensitivity", "confidential", "--pii", "none", "--export-mode", "json", "--delete-mode", "delete", "--retention", "retain-until-workspace-delete"];
      const preview = runCustomerGeneratorCli(argv, cwd);
      expect(preview.exitCode).toBe(0);
      const result = JSON.parse(preview.stdout) as { files: readonly { path: string; content: string }[] };
      expect(runCustomerGeneratorCli([...argv, "--write"], cwd).exitCode).toBe(0);
      for (const file of result.files) expect(readFileSync(join(cwd, file.path), "utf8")).toBe(file.content);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  it("runs the safe smoke command", () => {
    const result = runCustomerGeneratorCli(["smoke"], repoRoot);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true });
  });
});
