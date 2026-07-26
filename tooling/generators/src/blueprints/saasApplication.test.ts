import { createHash } from "node:crypto";
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
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  buildTemplateQuickstart,
  runGeneratorCli,
  type WorkflowBackedTemplateQuickstart,
  type WorkflowOptionalTemplateQuickstart,
} from "../index";
import {
  buildSaasApplicationAlpha1TargetPlan,
  buildSaasApplicationTargetPlan,
  saasApplicationBlueprint,
} from "./saasApplication";
import { buildFactorySaasApplicationFiles } from "./saasApplicationFactory";
import { REMOVED_CUSTOMER_TEMPLATE_SCRIPTS } from "./saasRegistrationProjections";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sourceModule = (path: string) =>
  new URL(
    `../../../../examples/saas-application/seed/source/${path}`,
    import.meta.url,
  ).href;

describe("saas application blueprint", () => {
  it("projects only the supported customer generator scripts", () => {
    const plan = buildSaasApplicationTargetPlan();
    const packageEntry = plan.entries.find(
      ({ path }) => path === "package.json",
    );
    if (!packageEntry) throw new Error("missing projected package.json");
    const scripts = (
      JSON.parse(packageEntry.content) as { scripts: Record<string, string> }
    ).scripts;
    expect(scripts["template:add-table"]).toContain("customer-cli.ts");
    expect(scripts["template:publish-workflow"]).toContain("customer-cli.ts");
    expect(scripts["template:smoke"]).toContain("customer-cli.ts");
    for (const name of [
      "template:init",
      "template:quickstart",
      "template:intake",
      "template:seed-demo",
      "template:handoff",
      "template:prototype",
      "template:add-client-domain",
      "template:workflow-output-smoke",
      "template:upgrade",
      "template:private-package:dry-run",
      "template:private-package:import",
    ]) {
      expect(scripts).not.toHaveProperty(name);
    }
    expect(plan.entries.map(({ path }) => path)).not.toContain(
      "tooling/generators/src/index.ts",
    );
    expect(
      plan.entries.find(
        ({ path }) => path === "docs/template/agent-pack-privacy.md",
      ),
    ).toMatchObject({
      ownership: "generated",
      action: "generate",
      upgrade: "regenerate",
      content: readFileSync(
        join(repoRoot, "docs/template/agent-pack-privacy.md"),
        "utf8",
      ),
    });
  });

  it("keeps the historical alpha.1 target projection byte-authoritative", () => {
    const plan = buildSaasApplicationAlpha1TargetPlan();
    expect(
      buildSaasApplicationAlpha1TargetPlan({
        name: "Compatibility Only",
        firstOutcome: "Must not rewrite historical output",
      }),
    ).toEqual(plan);
    const manifest = JSON.parse(
      readFileSync(
        join(
          repoRoot,
          "releases/v0.2.0-alpha.1/blueprints/saas-application.json",
        ),
        "utf8",
      ),
    ) as {
      readonly schemaVersion: number;
      readonly id: string;
      readonly provenance: string;
      readonly registrations: readonly string[];
      readonly entries: readonly unknown[];
    };

    expect({
      schemaVersion: plan.schemaVersion,
      id: plan.id,
      provenance: plan.provenance,
      registrations: plan.registrations,
      entries: plan.entries.map(
        ({ path, ownership, action, upgrade, sha256, replaces }) => ({
          path,
          ownership,
          action,
          upgrade,
          sha256,
          ...(replaces === undefined ? {} : { replaces }),
        }),
      ),
    }).toEqual({
      schemaVersion: manifest.schemaVersion,
      id: manifest.id,
      provenance: manifest.provenance,
      registrations: manifest.registrations,
      entries: manifest.entries,
    });
  });

  it("materializes the current disclosure and customer support surface", () => {
    const targetRoot = mkdtempSync(
      join(tmpdir(), "maestro-current-customer-projection-"),
    );
    try {
      const plan = buildSaasApplicationTargetPlan();
      for (const entry of plan.entries) {
        const target = join(targetRoot, entry.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, entry.content, { flag: "wx" });
      }

      expect(
        readFileSync(
          join(targetRoot, "docs/template/agent-pack-privacy.md"),
          "utf8",
        ),
      ).toBe(
        readFileSync(
          join(repoRoot, "docs/template/agent-pack-privacy.md"),
          "utf8",
        ),
      );
      expect(
        plan.entries
          .map(({ path }) => path)
          .filter((path) =>
            /privacy\.noNetwork|runtimeNetworkInterceptor/.test(path),
          ),
      ).toEqual([]);
      for (const path of [
        "apps/cli/src/factory/supportBundle.ts",
        "tooling/agent-pack/src/privacy/supportBundle.ts",
        "tooling/agent-pack/src/privacy/supportBundleCommand.ts",
        "tooling/agent-pack/src/privacy/nodeSupportBundleExporter.ts",
      ]) {
        expect(plan.entries.map((entry) => entry.path)).toContain(path);
        expect(existsSync(join(targetRoot, path))).toBe(true);
      }
      expect(
        readFileSync(
          join(targetRoot, "apps/cli/src/factory/customerComposition.ts"),
          "utf8",
        ),
      ).toContain("createSupportBundleCliHandler");
    } finally {
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it("keeps current support files out of the frozen alpha.1 plan", () => {
    const paths = buildSaasApplicationAlpha1TargetPlan().entries.map(
      ({ path }) => path,
    );
    expect(paths).not.toContain("docs/template/agent-pack-privacy.md");
    expect(paths).not.toContain("apps/cli/src/factory/supportBundle.ts");
    expect(paths).not.toContain(
      "tooling/agent-pack/src/privacy/supportBundle.ts",
    );
  });

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
    for (const path of [
      "tooling/generators/src/workflow-predeploy.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerV2Current.ts",
      "packages/convex/confect/workflows/_kit/observedStageCurrent.ts",
      "packages/convex/confect/workflows/_kit/observedStagePayloadCurrent.ts",
      "packages/convex/confect/workflows/_kit/workflowBuilderCurrent.ts",
      "packages/convex/confect/workflows/_kit/workflowSchedule.ts",
      "packages/convex/confect/workflows/_kit/workflowScheduledCapability.ts",
      "packages/convex/confect/workflows/graphCurrent.ts",
      "packages/convex/confect/workflows/graphNodeSchemaCurrent.ts",
      "packages/convex/confect/workflows/graphSchemaCurrent.ts",
      "packages/convex/confect/workflows/graphValidationCurrent.ts",
      "packages/convex/confect/capabilities/_kit/workspaceAccess.ts",
      "packages/convex/confect/workflows/lifecycle.spec.ts",
      "packages/convex/confect/workflows/lifecycle.impl.ts",
    ]) {
      expect(after.entries.find((entry) => entry.path === path)).toMatchObject({
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
        replaces: "copy",
      });
    }
    expect(
      after.entries.find(
        (entry) => entry.path === "tooling/generators/src/workflow-files.ts",
      ),
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
    const first = buildFactorySaasApplicationFiles({ name: "My App" });
    const second = buildFactorySaasApplicationFiles({ name: "My App" });
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
      "generated/blueprints/saas-application/application-contract.json",
      "generated/blueprints/saas-application/surface-contract.json",
      "generated/blueprints/saas-application/readiness.json",
      "docs/template/agent-pack-privacy.md",
      "apps/cli/src/factory/customerComposition.ts",
      "apps/cli/src/index.ts",
      "apps/cli/src/factory/start.ts",
      "apps/cli/src/factory/supportBundle.ts",
      "package.json",
      "tooling/generators/package.json",
      "tooling/quality/install-lefthook-if-git.mjs",
      "tooling/generators/src/customer.ts",
      "tooling/generators/src/customer-runtime.ts",
      "tooling/generators/src/customer-dispatcher.ts",
      "tooling/generators/src/customer-cli.ts",
      "tooling/generators/src/crud-proof.ts",
      "tooling/generators/src/direct-run.ts",
      "tooling/generators/src/workflow-release-commands.ts",
      "tooling/generators/src/workflow-source-closure.ts",
      "tooling/generators/src/blueprints/gtmImplementation.ts",
      "tooling/generators/src/workflow-files.ts",
      "tooling/generators/src/workflow-predeploy.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerV2Current.ts",
      "packages/convex/confect/workflows/_kit/observedStageCurrent.ts",
      "packages/convex/confect/workflows/_kit/observedStagePayloadCurrent.ts",
      "packages/convex/confect/workflows/_kit/workflowBuilderCurrent.ts",
      "packages/convex/confect/workflows/_kit/workflowSchedule.ts",
      "packages/convex/confect/workflows/_kit/workflowScheduledCapability.ts",
      "packages/convex/confect/workflows/graphCurrent.ts",
      "packages/convex/confect/workflows/graphNodeSchemaCurrent.ts",
      "packages/convex/confect/workflows/graphSchemaCurrent.ts",
      "packages/convex/confect/workflows/graphValidationCurrent.ts",
      "packages/convex/confect/capabilities/_kit/workspaceAccess.ts",
      "packages/convex/confect/_generated/docs.ts",
      "packages/convex/confect/_generated/tables/workflowArtifacts.ts",
      "packages/convex/confect/ops/dataResources.generated.ts",
      "packages/convex/confect/tables/workflowArtifacts.ts",
      "packages/convex/confect/tables/workflowRuns.ts",
      "packages/convex/confect/tables/workflowStageRuns.ts",
      "packages/convex/confect/workflows/_kit/defineMaestroWorkflow.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerExecution.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerNodes.ts",
      "packages/convex/confect/workflows/_kit/graphRunnerV2.ts",
      "packages/convex/confect/workflows/_kit/lifecycle.ts",
      "packages/convex/confect/workflows/_kit/lifecycleControls.ts",
      "packages/convex/confect/workflows/_kit/lifecycleSafety.ts",
      "packages/convex/confect/workflows/_kit/lifecycleState.ts",
      "packages/convex/confect/workflows/_kit/lifecycleSweep.ts",
      "packages/convex/confect/workflows/_kit/observedStage.ts",
      "packages/convex/confect/workflows/_kit/observedStagePayload.ts",
      "packages/convex/confect/workflows/_kit/payloadBudget.ts",
      "packages/convex/confect/workflows/_kit/policySnapshot.ts",
      "packages/convex/confect/workflows/_kit/principal.ts",
      "packages/convex/confect/workflows/_kit/subworkflows.ts",
      "packages/convex/confect/workflows/_kit/workflowArtifacts.ts",
      "packages/convex/confect/workflows/lifecycleAdapters.ts",
      "packages/convex/confect/workflows/lifecycle.impl.ts",
      "packages/convex/confect/workflows/lifecycleInspection.ts",
      "packages/convex/confect/workflows/lifecyclePersistence.ts",
      "packages/convex/confect/workflows/lifecycleReconciliation.ts",
      "packages/convex/confect/workflows/lifecycle.spec.ts",
      "packages/convex/test/workflow-lifecycle-controls.fixture.ts",
      "packages/convex/test/workflow-lifecycle-registration.test.ts",
      "tooling/quality/check-workflow-policy-snapshots.mts",
      "tooling/quality/check-workflow-principal-propagation.mts",
      "tooling/quality/fixtures/workflow-policy-snapshots.json",
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
      "tooling/agent-pack/src/privacy/supportBundle.ts",
      "tooling/agent-pack/src/privacy/supportBundleCommand.ts",
      "tooling/agent-pack/src/privacy/nodeSupportBundleExporter.ts",
      "tooling/agent-pack/src/privacy/support-bundle.schema.json",
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
    const files = buildFactorySaasApplicationFiles({ name: "My App" });
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
      "evals:agent-pack",
      "evals",
      "smoke:web-static",
      "review:readiness",
      "review:completion",
      "deploy:doctor",
      "deploy:cloudflare",
      "test:mutation",
      "check:recipes",
      "check:workflow-version-immutability",
      "check:workflow-publication-generation",
    ]);
    const factory = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as typeof root;
    expect(Object.keys(root.scripts)).toEqual([
      ...Object.keys(factory.scripts).filter(
        (name) =>
          !omittedScripts.has(name) &&
          !REMOVED_CUSTOMER_TEMPLATE_SCRIPTS.includes(
            name as (typeof REMOVED_CUSTOMER_TEMPLATE_SCRIPTS)[number],
          ),
      ),
      "maestro:crud-proof",
      "template:smoke",
    ]);
    const rewritten = new Set([
      "test:tooling",
      "check:coverage-ratchet",
      "coverage:update-baseline",
      "check:agent-pack",
      "prepare",
      "verify",
    ]);
    for (const [name, command] of Object.entries(factory.scripts)) {
      if (
        name.startsWith("template:") &&
        !REMOVED_CUSTOMER_TEMPLATE_SCRIPTS.includes(
          name as (typeof REMOVED_CUSTOMER_TEMPLATE_SCRIPTS)[number],
        )
      ) {
        expect(root.scripts[name]).toBe(
          command
            .replace(
              "tooling/generators/src/index.ts",
              "tooling/generators/src/customer-cli.ts",
            )
            .replace(
              "tooling/generators/src/cli.ts",
              "tooling/generators/src/customer-cli.ts",
            ),
        );
        continue;
      }
      if (
        !omittedScripts.has(name) &&
        !rewritten.has(name) &&
        !REMOVED_CUSTOMER_TEMPLATE_SCRIPTS.includes(
          name as (typeof REMOVED_CUSTOMER_TEMPLATE_SCRIPTS)[number],
        )
      )
        expect(root.scripts[name]).toBe(command);
    }
    expect(root.scripts["template:smoke"]).toBe(
      "tsx tooling/generators/src/customer-cli.ts smoke",
    );
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
    expect(customerContextCheck).toContain("sha256(installed) !== item.sha256");
    expect(customerContextCheck).toContain("hasClaudeInclude(content)");
    expect(
      customerContext.files.find(
        ({ path }) => path === ".claude/settings.json",
      ),
    ).toMatchObject({
      sha256:
        "sha256:7825364f57b5c5f07c64d5c5bbbaa8046a6c1c21d3216112cc86f99d2e5b6ccc",
      validation: "safe-claude-settings",
    });
    const generatedSettings = files.find(
      ({ path }) => path === ".claude/settings.json",
    )?.content;
    expect(
      createHash("sha256")
        .update(generatedSettings ?? "")
        .digest("hex"),
    ).toBe("7825364f57b5c5f07c64d5c5bbbaa8046a6c1c21d3216112cc86f99d2e5b6ccc");
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
