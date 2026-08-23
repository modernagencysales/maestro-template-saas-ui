import {
  existsSync,
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
import { buildAgentFiles } from "./customer-runtime";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const workflowAutomationSelected = existsSync(
  join(repoRoot, "tooling/workflow/package.json"),
);
const mutatingGeneratorCases: ReadonlyArray<readonly [string, string]> = [
  ["add-capability", "customerReview"],
  ...(workflowAutomationSelected
    ? ([["add-workflow", "customerReviewFlow"]] as const)
    : []),
];

const seedCatalogs = (cwd: string): void => {
  mkdirSync(join(cwd, "docs/template"), { recursive: true });
  for (const name of [
    "system-catalog.json",
    "data-resources.json",
    "product-topology.json",
    "saas-ui-screen-catalog.json",
    "saas-ui-starter-files.json",
  ]) {
    writeFileSync(
      join(cwd, "docs/template", name),
      readFileSync(join(repoRoot, "docs/template", name)),
    );
  }
  const catalog = JSON.parse(
    readFileSync(
      join(repoRoot, "docs/template/saas-ui-screen-catalog.json"),
      "utf8",
    ),
  ) as {
    starterRoutes: readonly {
      id: string;
      closure: readonly { source: string }[];
    }[];
  };
  const selected = catalog.starterRoutes.find(({ id }) =>
    id.endsWith("/_dashboard/contacts/index.tsx"),
  );
  if (!selected) throw new Error("Starter Contacts screen fixture is missing");
  for (const { source } of selected.closure) {
    mkdirSync(dirname(join(cwd, source)), { recursive: true });
    writeFileSync(join(cwd, source), readFileSync(join(repoRoot, source)));
  }
};

describe("customer generator runtime", () => {
  it("builds a neutral agent declaration", () => {
    const generated = buildAgentFiles({
      name: "workflow architect",
      system: "workflow-runtime",
      disposition: "reuse",
    });

    expect(generated).toMatchObject({
      name: "workflowArchitect",
      surfaces: [],
      headlessExposure: false,
    });
    expect(generated.files.map(({ path }) => path)).toEqual([
      "packages/convex/confect/agents/workflowArchitect.ts",
      "docs/template/generated/agents/workflowArchitect.md",
      "docs/template/generated/provenance/add-agent/workflowArchitect.json",
    ]);
  });

  it("rejects legacy private-package acknowledgement flags", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-private-"));
    const fixture = join(cwd, "examples/generic-ai-ops");
    try {
      mkdirSync(fixture, { recursive: true });
      writeFileSync(
        join(fixture, "template-package.json"),
        `${JSON.stringify({ name: "generic-ai-ops" })}\n`,
      );
      for (const legacyFlag of [
        ["--preflight-fingerprint", "legacy"],
        ["--privacy-reviewed"],
      ]) {
        const result = runCustomerGeneratorCli(
          [
            "private-package:import",
            "--fixture",
            "examples/generic-ai-ops",
            "--system",
            "knowledge-brain",
            "--disposition",
            "extend",
            "--write",
            ...legacyFlag,
          ],
          cwd,
        );
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`does not accept ${legacyFlag[0]}`);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

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

  it.each(mutatingGeneratorCases)(
    "previews and writes %s with identical bytes",
    (command, name) => {
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
        expect(
          runCustomerGeneratorCli([...argv, "--write"], cwd).exitCode,
        ).toBe(0);
        for (const file of result.files)
          expect(readFileSync(join(cwd, file.path), "utf8")).toBe(file.content);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  );

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
        "--screen-catalog-id",
        "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
      ],
      repoRoot,
    );

    expect(preview.exitCode).toBe(0);
    const result = JSON.parse(preview.stdout) as {
      files: readonly { path: string; content: string }[];
    };
    const adapter = result.files.find(({ path }) =>
      path.endsWith("/adapter.ts"),
    )?.content;
    const generated = result.files.map(({ content }) => content).join("\n");
    expect(adapter).toContain("presentCustomerReviewState");
    expect(adapter).not.toContain("createCustomerReviewAdapter");
    expect(generated).toContain("export const customerReviewRefs = Refs.make");
    expect(generated).toContain("ContactsListPage");
    expect(generated).not.toContain("<Page.Root>");
    expect(generated).not.toContain("templateConfectRefs");
    expect(generated).not.toContain("Synthetic fixture");
    expect(generated).not.toContain('status: "accepted"');
    expect(generated).not.toContain("Replace fake fixtures");
  });

  it("previews and writes the reviewed product shell configuration", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-customer-shell-"));
    try {
      const argv = [
        "configure-shell",
        "--dashboard-label",
        "Connections",
        "--dashboard-screen",
        "connections",
        "--inbox-label",
        "Agency Brain",
        "--inbox-screen",
        "brain",
        "--contacts-label",
        "Clients",
        "--contacts-screen",
        "clients",
        "--kanban-label",
        "Settings",
        "--kanban-route",
        "/$workspace/settings/account/profile",
        "--showcase-label",
        "Ask Maestro",
        "--showcase-route",
        "/$workspace/search",
        "--search-screen",
        "assistant",
      ];
      const preview = runCustomerGeneratorCli(argv, cwd);
      expect(preview.exitCode).toBe(0);
      expect(() =>
        readFileSync(join(cwd, "apps/web/src/config/product-shell.ts")),
      ).toThrow();
      expect(runCustomerGeneratorCli([...argv, "--write"], cwd).exitCode).toBe(
        0,
      );
      expect(
        readFileSync(join(cwd, "apps/web/src/config/product-shell.ts"), "utf8"),
      ).toContain("Agency Brain");
      expect(
        readFileSync(join(cwd, "apps/web/src/config/product-shell.ts"), "utf8"),
      ).toContain('inbox: "brain"');
      expect(
        readFileSync(join(cwd, "apps/web/src/config/product-shell.ts"), "utf8"),
      ).toContain('contacts: "clients"');
      expect(
        readFileSync(join(cwd, "apps/web/src/config/product-shell.ts"), "utf8"),
      ).toContain('search: "assistant"');
      expect(
        readFileSync(
          join(cwd, "docs/template/generated/provenance/configure-shell.json"),
          "utf8",
        ),
      ).toContain("starter-story:packages/ui/src/editor/editor.stories.tsx");
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
        "--business-entity",
      ];
      const preview = runCustomerGeneratorCli(argv, cwd);
      expect(preview.exitCode).toBe(0);
      const result = JSON.parse(preview.stdout) as {
        files: readonly { path: string; content: string }[];
      };
      expect(result.files[0]?.content).toContain(
        'Schema.Literals(["planned", "active", "complete"])',
      );
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
          screenCatalogId:
            "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
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
        reviewed.output.files.find(({ path }) => path.endsWith("/adapter.ts"))
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
