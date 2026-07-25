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
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  buildTemplateQuickstart,
  runGeneratorCli,
  type WorkflowBackedTemplateQuickstart,
  type WorkflowOptionalTemplateQuickstart,
} from "../index";
import {
  buildSaasApplicationFiles,
  buildSaasApplicationTargetPlan,
  saasApplicationBlueprint,
} from "./saasApplication";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sourceModule = (path: string) =>
  new URL(
    `../../../../examples/saas-application/seed/source/${path}`,
    import.meta.url,
  ).href;

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

  it("pins replacement projections to the reviewed release source", () => {
    const checkoutSpecPath = join(
      repoRoot,
      "packages/convex/confect/_generated/spec.ts",
    );
    const originalCheckoutSpec = readFileSync(checkoutSpecPath, "utf8");
    const before = buildSaasApplicationTargetPlan({ name: "My App" });
    let after: typeof before;
    try {
      writeFileSync(
        checkoutSpecPath,
        `${originalCheckoutSpec}\n// unrelated integration registration\n`,
      );
      after = buildSaasApplicationTargetPlan({ name: "My App" });
    } finally {
      writeFileSync(checkoutSpecPath, originalCheckoutSpec);
    }

    expect(after).toEqual(before);
    const projectedSpec = after.entries.find(
      ({ path }) => path === "packages/convex/confect/_generated/spec.ts",
    );
    expect(projectedSpec?.content).toContain(
      'import ops_versioning from "../ops/versioning.spec";',
    );
    expect(projectedSpec?.content).toContain(
      'import records from "../records/records.spec";',
    );
    expect(projectedSpec?.content).not.toContain(
      "unrelated integration registration",
    );
    for (const path of ["CLAUDE.md", ".claude/settings.json"]) {
      expect(after.entries.find((entry) => entry.path === path)).toMatchObject({
        ownership: "customer-extension",
        action: "copy",
        upgrade: "preserve",
      });
    }
    expect(
      after.entries.find((entry) => entry.path === "skills-lock.json"),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
    });
    expect(after.entries.some((entry) => entry.path === "AGENTS.md")).toBe(
      false,
    );
  });

  it("emits deterministic workspace-safe CRUD and readiness contracts", async () => {
    const first = buildSaasApplicationFiles({ name: "My App" });
    const second = buildSaasApplicationFiles({ name: "My App" });
    expect(first).toEqual(second);
    const customerContext = JSON.parse(
      first.find(
        ({ path }) => path === "docs/template/customer-context.manifest.json",
      )?.content ?? "{}",
    ) as { readonly files: readonly { readonly path: string }[] };
    const customerContextTargets = [
      "docs/template/customer-context.manifest.json",
      ...customerContext.files
        .filter(({ path }) => path !== "AGENTS.md")
        .map(({ path }) => path),
    ];
    expect(first.map(({ path }) => path)).toEqual([
      "examples/saas-application/seed/workspace.json",
      "examples/saas-application/seed/records.json",
      "examples/saas-application/seed/source.json",
      "examples/saas-application/seed/crud-scenario.json",
      "packages/convex/confect/tables/records.ts",
      "packages/convex/confect/records/records.spec.ts",
      "packages/convex/confect/records/records.impl.ts",
      "apps/web/src/adapters/records/contract.ts",
      "apps/web/src/adapters/records/fake.ts",
      "apps/web/src/features/records/model.ts",
      "apps/web/src/features/records/records-surface.tsx",
      "apps/web/src/screens/records-screen.tsx",
      "apps/web/src/routes/_workspace.records.tsx",
      "apps/cli/src/factory/customerComposition.ts",
      "apps/cli/src/index.ts",
      "apps/cli/src/factory/start.ts",
      "package.json",
      "tooling/quality/install-lefthook-if-git.mjs",
      "tooling/agent-pack/src/start.ts",
      "tooling/agent-pack/src/ports.ts",
      "tooling/agent-pack/src/verify.ts",
      "tooling/agent-pack/src/receiptWriter.ts",
      "tooling/agent-pack/src/index.ts",
      "tooling/agent-pack/src/readiness/artifacts.ts",
      "tooling/agent-pack/src/readiness/index.ts",
      "tooling/agent-pack/src/readiness/nodeSurface.ts",
      "tooling/agent-pack/src/readiness/presenter.ts",
      "tooling/agent-pack/src/readiness/server.ts",
      "tooling/quality/check-agent-pack.mts",
      "tooling/quality/check-customer-context.mts",
      "tooling/quality/check-convex-ai-files.mts",
      ...customerContextTargets,
      "packages/convex/confect/_generated/tables/records.ts",
      "packages/convex/confect/_generated/schema.ts",
      "packages/convex/confect/_generated/convexSchema.ts",
      "packages/convex/confect/_generated/spec.ts",
      "packages/convex/confect/_generated/id.ts",
      "packages/convex/confect/_generated/registeredFunctions/records.ts",
      "packages/convex/convex/records.ts",
      "apps/web/src/routeTree.gen.ts",
      "apps/web/src/routeRegistry.generated.ts",
      "generated/blueprints/saas-application/application-contract.json",
      "generated/blueprints/saas-application/surface-contract.json",
      "generated/blueprints/saas-application/readiness.json",
    ]);
    for (const file of first.slice(0, 4)) {
      expect(readFileSync(join(repoRoot, file.path), "utf8")).toBe(
        file.content,
      );
    }

    const contract = JSON.parse(
      first.find(({ path }) => path.endsWith("application-contract.json"))
        ?.content ?? "{}",
    );
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
    const executable = first.slice(4, 13);
    for (const file of executable) {
      const transpiled = transpileModule(file.content, {
        compilerOptions: {
          jsx: JsxEmit.ReactJSX,
          module: ModuleKind.ESNext,
          target: ScriptTarget.ES2022,
        },
        fileName: file.path,
        reportDiagnostics: true,
      });
      expect(transpiled.diagnostics ?? []).toEqual([]);
    }
    const spec = first.find(({ path }) => path.endsWith("records.spec.ts"));
    for (const operation of contract.operations) {
      expect(spec?.content).toContain(`operationId: "${operation.id}"`);
    }

    const surfaces = JSON.parse(
      first.find(({ path }) => path.endsWith("surface-contract.json"))
        ?.content ?? "{}",
    );
    expect(surfaces.web.operations).toEqual(surfaces.headless.operations);
    const { recordOperationContract } = (await import(
      sourceModule("apps/web/src/adapters/records/contract.ts")
    )) as {
      readonly recordOperationContract: readonly {
        readonly operationId: string;
      }[];
    };
    expect(
      recordOperationContract.map(({ operationId }) => operationId),
    ).toEqual(surfaces.web.operations);
    expect(surfaces.providers.fake).toMatchObject({
      status: "fake",
      behavior: "in-memory workspace-scoped CRUD",
    });
    expect(surfaces.providers.local).toMatchObject({
      status: "seam",
      placeholderSuccess: false,
    });

    const readiness = JSON.parse(
      first.find(({ path }) => path.endsWith("readiness.json"))?.content ??
        "{}",
    );
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

  it("projects a customer-only root script closure", () => {
    const files = buildSaasApplicationFiles({ name: "My App" });
    const customerContext = JSON.parse(
      files.find(
        ({ path }) => path === "docs/template/customer-context.manifest.json",
      )?.content ?? "{}",
    ) as { readonly files: readonly { readonly path: string }[] };
    const root = JSON.parse(
      files.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as {
      readonly packageManager: string;
      readonly scripts: Readonly<Record<string, string>>;
      readonly devDependencies: Readonly<Record<string, string>>;
    };
    const omittedPaths = [
      "tooling/evals",
      "tooling/pr-backlog",
      "tooling/release",
      "tooling/stack",
      ".buildkite",
    ];
    const omittedScripts = new Set([
      "test:pr-backlog",
      "test:stack",
      "stack:check",
      "stack:status",
      "stack:submit",
      "stack:sync",
      "stack:preflight",
      "stack:merge",
      "evals",
      "smoke:web-static",
      "review:readiness",
      "review:completion",
      "deploy:doctor",
      "deploy:cloudflare",
      "test:mutation",
    ]);
    const factory = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as typeof root;
    expect(Object.keys(root.scripts)).toEqual(
      Object.keys(factory.scripts).filter((name) => !omittedScripts.has(name)),
    );
    const rewritten = new Set([
      "test:tooling",
      "check:coverage-ratchet",
      "coverage:update-baseline",
      "check:agent-pack",
      "prepare",
      "verify",
    ]);
    for (const [name, command] of Object.entries(factory.scripts)) {
      if (!omittedScripts.has(name) && !rewritten.has(name))
        expect(root.scripts[name]).toBe(command);
    }
    expect(JSON.stringify(root.scripts)).not.toMatch(
      new RegExp(omittedPaths.join("|")),
    );
    for (const name of omittedScripts) {
      for (const command of Object.values(root.scripts))
        expect(command).not.toContain(`pnpm ${name}`);
    }
    expect(root.scripts.verify).toEqual(
      expect.stringContaining("pnpm check:agent-pack"),
    );
    expect(root.scripts.verify).toContain("pnpm check:convex-ai-files");
    for (const check of [
      "check:generators",
      "check:workflow-semantics",
      "check:data-resources",
      "check:system-catalog",
      "check:system-topology",
      "check:layer-boundaries",
    ])
      expect(root.scripts.verify).toContain(`pnpm ${check}`);
    const agentPackCheck = files.find(
      ({ path }) => path === "tooling/quality/check-agent-pack.mts",
    )?.content;
    expect(agentPackCheck).toContain("customerContextFindings(repoRoot)");
    expect(agentPackCheck).toContain("verificationArtifactFindings(repoRoot)");
    expect(agentPackCheck).toContain("forbiddenMcpFindings(repoRoot)");
    expect(agentPackCheck).not.toContain("checkSkillProjections");
    expect(agentPackCheck).not.toContain("factoryWiringFindings");
    expect(root.scripts["check:agent-pack"]).toBe(
      "tsx tooling/quality/check-agent-pack.mts",
    );
    const convexCheck = files.find(
      ({ path }) => path === "tooling/quality/check-convex-ai-files.mts",
    )?.content;
    expect(convexCheck).toContain("Installed Convex AI targets");
    expect(convexCheck).not.toContain("validateOfficialConvexBundle");
    const customerContextCheck = files.find(
      ({ path }) => path === "tooling/quality/check-customer-context.mts",
    )?.content;
    expect(customerContextCheck).toContain("customer-context:extra:");
    expect(customerContextCheck).toContain("safeClaudeSettings");
    for (const required of [
      "CLAUDE.md",
      ".claude/skills/convex/SKILL.md",
      ".agents/skills/maestro/SKILL.md",
      ".agents/skills/maestro-convex/SKILL.md",
      ".agents/skills/convex/SKILL.md",
      "skills-lock.json",
    ])
      expect(customerContext.files.map(({ path }) => path)).toContain(required);
    expect(root.packageManager).toBe(factory.packageManager);
    expect(root.devDependencies).toEqual(factory.devDependencies);
  });

  it("executes fake create, list, and read with workspace isolation", async () => {
    const { createFakeRecordAdapter } = (await import(
      sourceModule("apps/web/src/adapters/records/fake.ts")
    )) as {
      readonly createFakeRecordAdapter: () => {
        readonly list: (workspaceId: string) => Promise<readonly unknown[]>;
        readonly read: (workspaceId: string, id: string) => Promise<unknown>;
        readonly create: (input: {
          readonly workspaceId: string;
          readonly title: string;
          readonly detail: string;
        }) => Promise<{ readonly id: string }>;
      };
    };
    const adapter = createFakeRecordAdapter();
    expect(await adapter.list("workspace_a")).toEqual([]);
    const created = await adapter.create({
      workspaceId: "workspace_a",
      title: "First record",
      detail: "Created without provider setup.",
    });
    expect(await adapter.list("workspace_a")).toEqual([created]);
    expect(await adapter.read("workspace_a", created.id)).toEqual(created);
    expect(await adapter.list("workspace_b")).toEqual([]);
    expect(await adapter.read("workspace_b", created.id)).toBeNull();
  });

  it("presents loading, empty, error, list, detail, and create states", async () => {
    const { presentRecords } = (await import(
      sourceModule("apps/web/src/features/records/model.ts")
    )) as {
      readonly presentRecords: (state: {
        readonly status: string;
        readonly [key: string]: unknown;
      }) => { readonly status: string };
    };
    const record = {
      id: "record_1",
      workspaceId: "workspace_a",
      title: "First record",
      detail: "Readable detail",
      createdAt: 1,
      updatedAt: 1,
    };
    const states = [
      { status: "loading" as const },
      { status: "empty" as const },
      { status: "error" as const, message: "Unavailable" },
      { status: "list" as const, records: [record] },
      { status: "detail" as const, record },
      { status: "create" as const },
    ];
    expect(states.map((state) => presentRecords(state).status)).toEqual([
      "loading",
      "empty",
      "error",
      "list",
      "detail",
      "create",
    ]);
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

  it("writes every executable source target into a separate empty target", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-saas-write-"));
    try {
      const result = runGeneratorCli(
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
      expect(result.exitCode).toBe(0);
      const written = JSON.parse(result.stdout);
      for (const path of written.targets as readonly string[]) {
        expect(readFileSync(join(cwd, path), "utf8")).toBe(
          written.files.find((file: { path: string }) => file.path === path)
            ?.content,
        );
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("discriminates legacy workflow-backed and SaaS workflow-optional output", () => {
    const quickstart: WorkflowOptionalTemplateQuickstart =
      buildTemplateQuickstart({
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
    expect(quickstart.nextCommands).toEqual([
      'pnpm maestro -- create ../my-app --name "My App" --outcome "Create and review records" --write',
      "pnpm --dir ../my-app maestro -- start --mode fake",
    ]);
    const legacyIds = [
      "source-grounded-gtm-brain",
      "gtm-implementation",
    ] as const;
    for (const blueprint of legacyIds) {
      const legacy: WorkflowBackedTemplateQuickstart = buildTemplateQuickstart({
        blueprint,
        generatedAt: "2026-07-25T00:00:00.000Z",
      });
      expect(legacy.firstCapability).toEqual(expect.any(String));
      expect(legacy.firstWorkflow).toEqual(expect.any(String));
      expect(legacy.firstAgent).toEqual(expect.any(String));
      expect(legacy).not.toHaveProperty("targets");
      expect(legacy).not.toHaveProperty("collisions");
      expectTypeOf(legacy.firstWorkflow).toEqualTypeOf<string>();
    }
  });
});
