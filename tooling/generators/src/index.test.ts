import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";
import * as generatorExports from "./index";
import { maestroBlueprintCatalog } from "@maestro-template/app-idea-evaluator";
import {
  buildAgentFiles,
  buildBlueprintCatalog,
  buildCapabilityFiles,
  buildCapabilityPromotionFiles,
  buildClientDomainFiles,
  buildDemoSeedPlan,
  buildFeatureFiles,
  buildHandoffPacket,
  buildClientIntake,
  buildPrivatePackagePlan,
  buildTemplateInstance,
  buildTemplateQuickstart,
  buildTableFiles,
  buildTemplateUpgradeReport,
  buildWorkflowFiles,
  buildWorkflowPromotionFiles,
  doctorTemplateInstance,
  requiredEnvNamesForProvider,
  resolveReviewedGenerator,
  REVIEWED_GENERATOR_DESCRIPTORS,
  runReviewedGenerator,
  runGeneratorCli,
  runGeneratorCliProcess,
} from "./index";
import { gtmImplementationBlueprint } from "./blueprints/gtmImplementation";
import {
  copyRepoForSmoke,
  repoRootFromScript,
  runnerOwnershipFinding,
  runSmokeCommand,
  runSmokeCommandAsync,
  shouldCopyPath,
  smokeWorkflowName,
  sourceFingerprint,
  workflowOutputSmokeScriptName,
} from "./workflow-output-smoke";
import {
  buildWorkflowPredeployPlan,
  compileGeneratedWorkflowFailureRoutes,
  WorkflowPredeployGenerationError,
} from "./workflow-predeploy";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "../../..");
const starterContactsScreenId =
  "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx";

describe("generator package boundary", () => {
  it("exports customer-composition helpers", () => {
    expect(generatorExports.isWorkflowAutomationPath).toBeTypeOf("function");
    expect(generatorExports.isRecordsOnlyWorkflowProvenancePath).toBeTypeOf(
      "function",
    );
    expect(generatorExports.createTemplateInstanceMigration).toBeTypeOf(
      "function",
    );
  });
});

describe("reviewed generator operation", () => {
  const request = {
    generatorId: "add-capability",
    args: {
      name: "agentPackParity",
      system: "knowledge-brain",
      disposition: "extend",
      exposure: "headless",
    },
  } as const;

  it("returns the exact canonical preview bytes", () => {
    const direct = runGeneratorCli(
      [
        "add-capability",
        "--name",
        request.args.name,
        "--system",
        request.args.system,
        "--disposition",
        request.args.disposition,
        "--exposure",
        request.args.exposure,
      ],
      repoRoot,
    );
    const reviewed = runReviewedGenerator({
      ...request,
      write: false,
      cwd: repoRoot,
    });

    expect(direct.exitCode).toBe(0);
    expect(reviewed).toMatchObject({ ok: true, output: { collisions: [] } });
    if (!reviewed.ok) throw new Error(reviewed.message);
    expect(reviewed.output.files).toEqual(JSON.parse(direct.stdout).files);
  });
  it("treats reviewed mutable catalogs as replacements, not customer collisions", () => {
    const reviewed = runReviewedGenerator({
      generatorId: "add-table",
      args: {
        name: "ReviewedCatalogFixture",
        system: "access-and-tenancy",
        disposition: "extend",
        tenantScope: "workspace",
        sensitivity: "internal",
        pii: "none",
        exportMode: "json",
        deleteMode: "delete",
        retention: "retain-until-workspace-delete",
        appendOnly: false,
      },
      write: false,
      cwd: repoRoot,
    });
    expect(reviewed).toMatchObject({ ok: true });
    if (!reviewed.ok) throw new Error(reviewed.message);
    expect(reviewed.output.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "docs/template/system-catalog.json",
        "docs/template/data-resources.json",
      ]),
    );
    expect(reviewed.output.collisions).not.toEqual(
      expect.arrayContaining([
        "docs/template/system-catalog.json",
        "docs/template/data-resources.json",
      ]),
    );
  });

  it("exposes one reviewed descriptor registry without changing CLI entrypoints", () => {
    expect(resolveReviewedGenerator("add-capability")).toEqual({
      supported: true,
    });
    expect(resolveReviewedGenerator("invent-widget")).toMatchObject({
      supported: false,
      nearest: [REVIEWED_GENERATOR_DESCRIPTORS[0]],
    });
    expect(runGeneratorCli(["help"], repoRoot).stdout).toContain(
      "template:add-capability --name <name>",
    );
    expect(runGeneratorCli(["help"], repoRoot).stdout).toContain(
      "template:bump-workflow --name <name> --from <N> --to <N+1>",
    );
    expect(runGeneratorCli(["help"], repoRoot).stdout).toContain(
      "template:publish-capability --name <name> --version <N>",
    );
  });

  it("refuses reviewed writes when any generated path exists", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-reviewed-generator-"));
    try {
      const preview = runReviewedGenerator({ ...request, write: false, cwd });
      if (!preview.ok) throw new Error(preview.message);
      const occupied = preview.output.files[0];
      if (occupied === undefined) throw new Error("missing generated fixture");
      const occupiedPath = join(cwd, occupied.path);
      mkdirSync(dirname(occupiedPath), { recursive: true });
      writeFileSync(occupiedPath, "user-owned\n");

      expect(
        runReviewedGenerator({ ...request, write: true, cwd }),
      ).toMatchObject({
        ok: false,
        message: expect.stringContaining("existing paths"),
      });
      expect(readFileSync(occupiedPath, "utf8")).toBe("user-owned\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("workflow generator predeploy projection", () => {
  const failure = {
    _tag: "WorkflowSettledFailure",
    code: "PROVIDER_REJECTED",
    message: "Provider rejected the request.",
  } as const;

  it("projects declared error-edge and compensation policies", () => {
    expect(
      compileGeneratedWorkflowFailureRoutes([
        {
          id: "charge",
          failurePolicy: {
            kind: "error-edge",
            edgeId: "charge-error",
            failure,
          },
        },
        {
          id: "notify",
          failurePolicy: {
            kind: "compensation",
            edgeId: "notify-compensated",
            steps: [
              {
                forNodeId: "notify",
                capability: "capability.retractNotification.v2",
                stepName: "retract-notification.v2",
              },
            ],
            failure,
          },
        },
        { id: "receipt", failurePolicy: { kind: "fail" } },
      ]),
    ).toEqual({
      charge: {
        kind: "error-edge",
        edgeId: "charge-error",
        failure,
      },
      notify: {
        kind: "compensation",
        edgeId: "notify-compensated",
        steps: [
          {
            forNodeId: "notify",
            capability: "capability.retractNotification.v2",
            stepName: "retract-notification.v2",
          },
        ],
        failure,
      },
    });
  });

  it("rejects routing not declared by the generated node", () => {
    expect(() =>
      compileGeneratedWorkflowFailureRoutes(
        [{ id: "charge", failurePolicy: { kind: "fail" } }],
        {
          charge: {
            kind: "error-edge",
            edgeId: "charge-error",
            failure,
          },
        },
      ),
    ).toThrowError(
      new WorkflowPredeployGenerationError([
        "charge: undeclared error-edge routing; declare nodes[].failurePolicy or retain fail behavior",
      ]),
    );
  });

  it("fails predeploy generation on conflicting environment Workpools", () => {
    type Options = {
      readonly maxParallelism: number;
      readonly retryActionsByDefault: boolean;
    };
    const workflowWorkpoolConfigurationFindings = (
      _environment: "production",
      declarations: readonly {
        readonly component: string;
        readonly options: Options;
      }[],
    ): readonly string[] =>
      declarations.flatMap(({ component, options }) =>
        options.maxParallelism === 20 && !options.retryActionsByDefault
          ? []
          : [
              `${component}: Workpool configuration conflicts with the production workflow budget`,
            ],
      );

    expect(() =>
      buildWorkflowPredeployPlan({
        environment: "production" as const,
        declarationGroups: [
          {
            component: "workflow",
            options: { maxParallelism: 20, retryActionsByDefault: false },
          },
          [
            {
              component: "workflow-shadow",
              options: {
                maxParallelism: 3,
                retryActionsByDefault: true,
              },
            },
          ],
        ],
        workflowWorkpoolConfigurationFindings,
      }),
    ).toThrow("workflow-shadow: Workpool configuration conflicts");
  });
});

describe("template app factory generators", () => {
  it("exercises workflow smoke path filtering and tiny-tree copying", () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-smoke-source-"));
    const targetParent = mkdtempSync(join(tmpdir(), "workflow-smoke-target-"));
    const target = join(targetParent, "repo");
    try {
      mkdirSync(join(root, "kept"), { recursive: true });
      mkdirSync(join(root, "node_modules"), { recursive: true });
      mkdirSync(join(root, "packages/convex"), { recursive: true });
      writeFileSync(join(root, "kept/value.ts"), "export const value = 1;\n");
      writeFileSync(join(root, ".env.secret"), "SECRET=hidden\n");
      writeFileSync(join(root, "node_modules/marker"), "shared\n");
      writeFileSync(join(root, "packages/convex/.env.local"), "LOCAL=fake\n");

      expect(repoRootFromScript()).toBe(repoRoot);
      expect(shouldCopyPath(root, root)).toBe(true);
      expect(shouldCopyPath(root, join(root, "kept/value.ts"))).toBe(true);
      expect(shouldCopyPath(root, join(root, "node_modules/marker"))).toBe(
        false,
      );
      expect(shouldCopyPath(root, join(root, ".env.secret"))).toBe(false);

      copyRepoForSmoke(root, target);
      expect(readFileSync(join(target, "kept/value.ts"), "utf8")).toContain(
        "value = 1",
      );
      expect(existsSync(join(target, ".env.secret"))).toBe(false);
      expect(lstatSync(join(target, "node_modules")).isSymbolicLink()).toBe(
        true,
      );
      expect(
        readFileSync(join(target, "packages/convex/.env.local"), "utf8"),
      ).toContain("LOCAL=fake");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(targetParent, { recursive: true, force: true });
    }
  });

  it("runs smoke commands and fingerprints their owned source", () => {
    runSmokeCommand(repoRoot, {
      label: "fast success",
      command: process.execPath,
      args: ["-e", "process.exit(0)"],
    });
    expect(() =>
      runSmokeCommand(repoRoot, {
        label: "fast failure",
        command: process.execPath,
        args: ["-e", "process.exit(3)"],
      }),
    ).toThrow("fast failure failed with exit code 3");

    expect(sourceFingerprint("runner-a")).toHaveLength(64);
    expect(sourceFingerprint("runner-a")).not.toBe(
      sourceFingerprint("runner-b"),
    );
  });

  it("detects corrupted and deleted owned runner projections", () => {
    const root = mkdtempSync(join(tmpdir(), "runner-ownership-"));
    const runner = join(root, "runner.ts");
    const expectedSource = "export const run = true;\n";
    const expectedFingerprint = createHash("sha256")
      .update(expectedSource)
      .digest("hex");
    try {
      writeFileSync(runner, `${expectedSource}// corrupt\n`);
      expect(runnerOwnershipFinding(runner, expectedFingerprint)).toContain(
        "fingerprint changed",
      );
      rmSync(runner);
      expect(runnerOwnershipFinding(runner, expectedFingerprint)).toBe(
        "runner projection is missing",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ships demo-safe GTM implementation seed fixtures", () => {
    const accounts = JSON.parse(
      readFileSync(
        join(repoRoot, "examples/gtm-implementation/seed/accounts.json"),
        "utf8",
      ),
    ) as readonly { readonly name: string; readonly domain: string }[];
    const people = JSON.parse(
      readFileSync(
        join(repoRoot, "examples/gtm-implementation/seed/people.json"),
        "utf8",
      ),
    ) as readonly {
      readonly name: string;
      readonly email: string;
      readonly accountDomain: string;
    }[];
    const sources = readFileSync(
      join(repoRoot, "examples/gtm-implementation/seed/sources.md"),
      "utf8",
    );

    expect(accounts.length).toBeGreaterThan(0);
    expect(people.length).toBeGreaterThan(0);
    expect(
      accounts.every((account) => account.domain.endsWith(".example")),
    ).toBe(true);
    expect(
      people.every(
        (person) =>
          person.email.endsWith(".example") &&
          person.accountDomain.endsWith(".example"),
      ),
    ).toBe(true);
    expect(accounts.map((account) => account.name).join("\n")).toContain(
      "Example",
    );
    expect(people.map((person) => person.name).join("\n")).toContain("Demo");
    expect(sources).toContain("Synthetic GTM implementation sources");
    expect(sources).not.toMatch(/gmail\.com|hubspot\.com|salesforce\.com/i);
  });

  it("ships an opinionated AI/GTM brain blueprint catalog", () => {
    const catalog = buildBlueprintCatalog();

    expect(catalog.map((blueprint) => blueprint.id)).toContain(
      "source-grounded-gtm-brain",
    );
    expect(catalog[0]).toMatchObject({
      id: "source-grounded-gtm-brain",
      defaultCapability: "summarizeSource",
      defaultWorkflow: "sourceGroundedPlan",
      defaultAgent: "gtmBrainPlanner",
      providerPosture: "fake-first",
    });
    expect(catalog[0]?.surfaces).toEqual(["web", "api", "cli", "mcp"]);
  });

  it("uses the shared Maestro catalog as the complete implemented registry", () => {
    const sharedImplementedIds = maestroBlueprintCatalog
      .filter(({ status }) => status === "implemented")
      .map(({ id }) => id);

    expect(buildBlueprintCatalog().map(({ id }) => id)).toEqual(
      sharedImplementedIds,
    );
    expect(sharedImplementedIds).toContain("saas-application");
  });

  it("registers the optional GTM implementation blueprint without making it default", () => {
    const catalog = buildBlueprintCatalog();

    expect(gtmImplementationBlueprint).toMatchObject({
      id: "gtm-implementation",
      optional: true,
      providerSeams: ["crm", "drive", "notion"],
      reportingSurfaces: ["account brief", "pipeline funnel", "activity board"],
    });
    expect(catalog[0]?.id).toBe("source-grounded-gtm-brain");
    expect(catalog.map((blueprint) => blueprint.id)).toContain(
      "gtm-implementation",
    );
  });

  it("builds a fake-provider template instance by default", () => {
    const instance = buildTemplateInstance({
      name: "North Star Brain",
      generatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(instance).toMatchObject({
      name: "North Star Brain",
      slug: "north-star-brain",
      packageScope: "@north-star-brain",
      providerMode: "fake",
      blueprint: "source-grounded-gtm-brain",
      providers: {
        convex: "fake",
        email: "console",
        storage: "local",
      },
    });
    expect(instance.environments).toEqual(["local", "preview", "production"]);
    expect(instance.deploymentTargets).toEqual([
      "local",
      "cloudflare-pages",
      "convex",
    ]);
    expect(instance.requiredSecretNames).toEqual(
      expect.arrayContaining([
        "WORKOS_API_KEY",
        "POSTHOG_PROJECT_TOKEN",
        "DODO_API_KEY",
        "POSTMARK_SERVER_TOKEN",
        "OPENROUTER_API_KEY",
      ]),
    );
    expect(instance.redactionStatus).toBe("reviewer-safe-fake-data");
    expect(instance.sourcePosture).toBe("synthetic-demo-data");
    expect(instance.modules).toEqual([
      "brain",
      "workflows",
      "capabilities",
      "agents",
      "api",
      "mcp",
      "integrations",
      "safety",
    ]);
  });

  it("tracks release, upgrade, and private-package readiness in the instance manifest", () => {
    const instance = buildTemplateInstance({
      name: "North Star Brain",
      generatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(instance.releaseState).toMatchObject({
      stage: "local",
      promotedCommit: null,
      lastHandoffAt: null,
    });
    expect(instance.upgradeCompatibility).toMatchObject({
      templateVersion: "unreleased",
      lastCheckedTemplateVersion: null,
      status: "not-checked",
      requiredChecks: expect.arrayContaining([
        "pnpm check:confect-contracts",
        "pnpm check:workflow-graph-boundary",
      ]),
    });
    expect(instance.privatePackages).toEqual({
      enabled: false,
      packages: [],
      promotionPolicy: "contract-review-required",
    });
  });

  it("builds a self-contained quickstart plan for the default blueprint", () => {
    const quickstart = buildTemplateQuickstart({
      name: "Reviewer Brain",
      blueprint: "source-grounded-gtm-brain",
      generatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(quickstart).toMatchObject({
      blueprint: "source-grounded-gtm-brain",
      instance: {
        name: "Reviewer Brain",
        slug: "reviewer-brain",
        providerMode: "fake",
      },
      firstCapability: "summarizeSource",
      firstWorkflow: "sourceGroundedPlan",
      firstAgent: "gtmBrainPlanner",
    });
    expect(quickstart.files.map((file) => file.path)).toEqual([
      "template-instance.json",
      "docs/template/generated/implementation-brief.md",
      "docs/template/generated/provider-setup-checklist.md",
      "generated/app-factory/day-0-loop.json",
      "examples/demo-seed/source-grounded-gtm-brain/demo-seed.json",
      "docs/template/generated/handoff-packet.md",
      "docs/template/generated/provenance/quickstart/reviewer-brain.json",
    ]);
    expect(quickstart.nextCommands).toEqual([
      "pnpm template:doctor -- --mode fake",
      "review docs/template/generated/provider-setup-checklist.md",
      "pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write",
      "pnpm template:add-client-domain -- --name customerContext --system knowledge-brain --disposition extend --write",
      "pnpm template:add-capability -- --name summarizeSource --system knowledge-brain --disposition extend --write",
      "pnpm template:add-workflow -- --name sourceGroundedPlan --system knowledge-brain --disposition extend --write",
      "pnpm template:handoff -- --mode fake --write",
    ]);
    expect(quickstart.files[1]?.content).toContain("source-backed GTM brain");
    expect(quickstart.files[2]?.content).toContain("WorkOS");
    expect(quickstart.files[2]?.content).toContain("env-manifest.md");
    expect(JSON.parse(quickstart.files[3]?.content ?? "{}")).toMatchObject({
      firstDomainNoun: "customerContext",
      firstCapability: "summarizeSource",
      firstWorkflow: "sourceGroundedPlan",
      firstAgent: "gtmBrainPlanner",
    });
    expect(quickstart.files[5]?.content).toContain("No live secrets required");
  });

  it("builds a GTM implementation quickstart with provider and reporting seams", () => {
    const quickstart = buildTemplateQuickstart({
      name: "GTM Brain",
      blueprint: "gtm-implementation",
      generatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(quickstart).toMatchObject({
      blueprint: "gtm-implementation",
      firstCapability: "buildAccountBrief",
      firstWorkflow: "gtmAccountResearch",
      firstAgent: "gtmImplementationPlanner",
    });
    expect(quickstart.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "generated/blueprints/gtm-implementation/provider-seams.json",
        "generated/blueprints/gtm-implementation/reporting-surfaces.json",
      ]),
    );
    expect(
      JSON.parse(
        quickstart.files.find((file) =>
          file.path.endsWith("provider-seams.json"),
        )?.content ?? "{}",
      ),
    ).toMatchObject({
      seams: expect.arrayContaining([
        expect.objectContaining({ id: "crm", mode: "fake/test/live-ready" }),
        expect.objectContaining({ id: "drive", mode: "fake/test/live-ready" }),
        expect.objectContaining({ id: "notion", mode: "fake/test/live-ready" }),
      ]),
    });
    expect(
      JSON.parse(
        quickstart.files.find((file) =>
          file.path.endsWith("reporting-surfaces.json"),
        )?.content ?? "{}",
      ),
    ).toMatchObject({
      promotionPath:
        "generated reporting seams stay outside template core until reviewed",
    });
  });

  it("writes quickstart files through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-quickstart-"));

    try {
      const result = runGeneratorCli(
        [
          "quickstart",
          "--blueprint",
          "source-grounded-gtm-brain",
          "--name",
          "Reviewer Brain",
          "--write",
        ],
        cwd,
      );
      const instancePath = join(cwd, "template-instance.json");
      const briefPath = join(
        cwd,
        "docs/template/generated/implementation-brief.md",
      );
      const providerChecklistPath = join(
        cwd,
        "docs/template/generated/provider-setup-checklist.md",
      );
      const seedPath = join(
        cwd,
        "examples/demo-seed/source-grounded-gtm-brain/demo-seed.json",
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        blueprint: "source-grounded-gtm-brain",
        firstWorkflow: "sourceGroundedPlan",
      });
      expect(JSON.parse(readFileSync(instancePath, "utf8"))).toMatchObject({
        slug: "reviewer-brain",
        blueprint: "source-grounded-gtm-brain",
      });
      expect(readFileSync(briefPath, "utf8")).toContain("Reviewer Brain");
      expect(readFileSync(providerChecklistPath, "utf8")).toContain(
        "fake mode",
      );
      expect(JSON.parse(readFileSync(seedPath, "utf8"))).toMatchObject({
        blueprint: "source-grounded-gtm-brain",
        sources: expect.arrayContaining([
          expect.objectContaining({ kind: "markdown" }),
          expect.objectContaining({ kind: "link" }),
        ]),
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes GTM implementation quickstart files through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-gtm-quickstart-"));

    try {
      const result = runGeneratorCli(
        [
          "quickstart",
          "--blueprint",
          "gtm-implementation",
          "--name",
          "GTM Brain",
          "--write",
        ],
        cwd,
      );
      const instancePath = join(cwd, "template-instance.json");
      const providerSeamsPath = join(
        cwd,
        "generated/blueprints/gtm-implementation/provider-seams.json",
      );
      const reportingSurfacesPath = join(
        cwd,
        "generated/blueprints/gtm-implementation/reporting-surfaces.json",
      );
      const seedPath = join(
        cwd,
        "examples/demo-seed/gtm-implementation/demo-seed.json",
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        blueprint: "gtm-implementation",
        firstWorkflow: "gtmAccountResearch",
      });
      expect(JSON.parse(readFileSync(instancePath, "utf8"))).toMatchObject({
        slug: "gtm-brain",
        blueprint: "gtm-implementation",
      });
      expect(JSON.parse(readFileSync(providerSeamsPath, "utf8"))).toMatchObject(
        {
          seams: expect.arrayContaining([
            expect.objectContaining({ id: "crm" }),
            expect.objectContaining({ id: "drive" }),
            expect.objectContaining({ id: "notion" }),
          ]),
        },
      );
      expect(
        JSON.parse(readFileSync(reportingSurfacesPath, "utf8")),
      ).toMatchObject({
        promotionPath:
          "generated reporting seams stay outside template core until reviewed",
      });
      expect(JSON.parse(readFileSync(seedPath, "utf8"))).toMatchObject({
        blueprint: "gtm-implementation",
        workflowRun: {
          workflow: "gtmAccountResearch",
          status: "ready",
        },
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes a client intake brief and updates the instance manifest through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-intake-"));

    try {
      const result = runGeneratorCli(
        ["intake", "--name", "North Star Brain", "--write"],
        cwd,
      );
      const intakePath = join(cwd, "docs/template/generated/client-intake.md");
      const instancePath = join(cwd, "template-instance.json");
      const intake = readFileSync(intakePath, "utf8");
      const instance = JSON.parse(readFileSync(instancePath, "utf8"));

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        instance: {
          name: "North Star Brain",
          intake: {
            status: "draft",
            briefPath: "docs/template/generated/client-intake.md",
          },
        },
      });
      expect(intake).toContain("# North Star Brain Client Intake");
      expect(intake).toContain("Source Inventory");
      expect(intake).toContain("First Workflow");
      expect(intake).toContain("Provider Posture");
      expect(intake).toContain("No live secrets required");
      expect(instance).toMatchObject({
        name: "North Star Brain",
        intake: {
          status: "draft",
          briefPath: "docs/template/generated/client-intake.md",
        },
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds deterministic client intake content for discovery calls", () => {
    const intake = buildClientIntake({
      name: "Reviewer Brain",
      generatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(intake.instance.intake).toMatchObject({
      status: "draft",
      generatedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(intake.files.map((file) => file.path)).toEqual([
      "template-instance.json",
      "docs/template/generated/client-intake.md",
      "docs/template/generated/provenance/intake/reviewer-brain.json",
    ]);
    expect(intake.files[1]?.content).toContain("What business outcome should");
    expect(intake.files[1]?.content).toContain(
      "Which sources are authoritative",
    );
  });

  it("writes direct seed and handoff artifacts with provenance through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-direct-"));

    try {
      const seed = runGeneratorCli(
        ["seed-demo", "--name", "Reviewer Brain", "--write"],
        cwd,
      );
      const handoff = runGeneratorCli(
        ["handoff", "--name", "Reviewer Brain", "--write"],
        cwd,
      );
      const seedProvenancePath = join(
        cwd,
        "docs/template/generated/provenance/seed-demo/reviewer-brain.json",
      );
      const handoffProvenancePath = join(
        cwd,
        "docs/template/generated/provenance/handoff/reviewer-brain.json",
      );

      expect(seed.exitCode).toBe(0);
      expect(handoff.exitCode).toBe(0);
      expect(
        existsSync(
          join(
            cwd,
            "examples/demo-seed/source-grounded-gtm-brain/demo-seed.json",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(join(cwd, "docs/template/generated/handoff-packet.md")),
      ).toBe(true);
      expect(
        JSON.parse(readFileSync(seedProvenancePath, "utf8")),
      ).toMatchObject({
        generator: "seed-demo",
        commandFamily: "template:seed-demo",
        generatedPaths: [
          "examples/demo-seed/source-grounded-gtm-brain/demo-seed.json",
        ],
      });
      expect(
        JSON.parse(readFileSync(handoffProvenancePath, "utf8")),
      ).toMatchObject({
        generator: "handoff",
        commandFamily: "template:handoff",
        generatedPaths: ["docs/template/generated/handoff-packet.md"],
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds deterministic fake demo seed data for the default blueprint", () => {
    const seed = buildDemoSeedPlan({
      blueprint: "source-grounded-gtm-brain",
      workspaceSlug: "reviewer-brain",
    });

    expect(seed).toMatchObject({
      blueprint: "source-grounded-gtm-brain",
      workspaceSlug: "reviewer-brain",
      providerMode: "fake",
      workflowRun: {
        workflow: "sourceGroundedPlan",
        status: "ready",
      },
    });
    expect(seed.sources.map((source) => source.kind)).toEqual([
      "markdown",
      "link",
      "note",
    ]);
    expect(seed.trustReceipt.evidenceCount).toBe(seed.sources.length);
  });

  it("builds a fake-mode handoff packet without secrets", () => {
    const packet = buildHandoffPacket({
      name: "Reviewer Brain",
      blueprint: "source-grounded-gtm-brain",
      mode: "fake",
    });

    expect(packet.mode).toBe("fake");
    expect(packet.sections.map((section) => section.id)).toEqual([
      "overview",
      "status-labels",
      "architecture",
      "quickstart",
      "providers",
      "verification",
      "next-steps",
    ]);
    expect(packet.markdown).toContain("Reviewer Brain");
    expect(packet.markdown).toContain("No live secrets required");
    expect(packet.markdown).toContain("`real`");
    expect(packet.markdown).toContain("`fake`");
    expect(packet.markdown).toContain("`seam`");
    expect(packet.markdown).toContain("`planned`");
    expect(packet.markdown).not.toMatch(/api[_-]?key|bearer|sk-[a-z0-9]/i);
  });

  it("prints quickstart, seed, and handoff help", () => {
    const result = runGeneratorCli(["help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "Supported blueprints: source-grounded-gtm-brain, gtm-implementation, saas-application",
    );
    expect(result.stdout).toContain(
      "Planned blueprints: implementation-consulting-brain, internal-ops-agent-workspace, custom-domain-ai-app",
    );
    expect(result.stdout).toContain("template:quickstart");
    expect(result.stdout).toContain("template:seed-demo");
    expect(result.stdout).toContain("template:handoff");
    expect(result.stdout).toContain("template:add-client-domain");
    expect(result.stdout).toContain("template:add-agent");
    expect(result.stdout).toContain("template:add-agent-seat");
  });

  it.each(["add-table", "add-workflow", "systems", "doctor"])(
    "prints exact leaf help for %s",
    (command) => {
      for (const flag of ["--help", "-h"]) {
        for (const argv of [
          [command, flag],
          [command, "--", flag],
        ]) {
          const result = runGeneratorCli(argv);
          expect(result.exitCode).toBe(0);
          expect(result.stderr).toBe("");
          expect(result.stdout).toMatch(
            new RegExp(`^template:${command}(?: |\\n)`),
          );
        }
      }
    },
  );

  it("rejects planned blueprints with a useful error", () => {
    const result = runGeneratorCli([
      "quickstart",
      "--blueprint",
      "implementation-consulting-brain",
      "--name",
      "Planned Brain",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Blueprint implementation-consulting-brain is planned, not generator-supported",
    );
    expect(result.stderr).toContain("source-grounded-gtm-brain");
    expect(result.stderr).toContain("gtm-implementation");
    expect(result.stderr).toContain("saas-application");
  });

  it("doctors fake instances without requiring live secrets", () => {
    const report = doctorTemplateInstance(buildTemplateInstance(), {
      mode: "fake",
      instancePath: "template-instance.json",
    });

    expect(report.ok).toBe(true);
    expect(report.manifestPath).toContain("docs/template/env-manifest.json");
    expect(report.checks.every((check) => check.status !== "fail")).toBe(true);
    expect(report.checks.map((check) => check.id)).toContain("provider:workos");
  });

  it("loads provider requirements from the env manifest", () => {
    expect(requiredEnvNamesForProvider("posthog")).toEqual([
      "POSTHOG_HOST",
      "POSTHOG_PROJECT_TOKEN",
    ]);
    expect(requiredEnvNamesForProvider("posthog")).not.toContain(
      "POSTHOG_API_KEY",
    );
    expect(requiredEnvNamesForProvider("llm")).toEqual(
      expect.arrayContaining([
        "OPENROUTER_API_KEY",
        "LLM_DAILY_SPEND_LIMIT_CENTS",
        "LLM_DEFAULT_MODEL",
      ]),
    );
    expect(requiredEnvNamesForProvider("storage")).toEqual(
      expect.arrayContaining([
        "STORAGE_BUCKET",
        "STORAGE_PUBLIC_BASE_URL",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
      ]),
    );
  });

  it("warns when a fake instance is doctored for live mode", () => {
    const report = doctorTemplateInstance(buildTemplateInstance(), {
      mode: "live",
    });

    expect(report.ok).toBe(true);
    expect(report.warningCount).toBe(
      report.checks.filter((check) => check.status === "warn").length,
    );
    expect(report.failureCount).toBe(0);
    expect(report.summary).toBe(
      `mode=live ok=true warnings=${report.warningCount} failures=0`,
    );
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "provider:workos",
        status: "warn",
      }),
    );
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "provider:llm",
        detail: expect.stringContaining("OPENROUTER_API_KEY"),
      }),
    );
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "provider:posthog",
        detail: expect.stringContaining("POSTHOG_PROJECT_TOKEN"),
      }),
    );
    expect(report.checks.map((check) => check.detail).join("\n")).not.toMatch(
      /sk-[a-z0-9]|bearer\s+[a-z0-9]/i,
    );
  });

  it("writes and doctors an instance through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-generator-"));

    try {
      const init = runGeneratorCli(
        ["init", "--name", "Client Brain", "--write"],
        cwd,
      );
      const doctor = runGeneratorCli(["doctor", "--mode", "fake"], cwd);

      expect(init.exitCode).toBe(0);
      expect(JSON.parse(init.stdout)).toMatchObject({
        slug: "client-brain",
      });
      expect(doctor.exitCode).toBe(0);
      expect(JSON.parse(doctor.stdout)).toMatchObject({
        ok: true,
        mode: "fake",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds client domain scaffolds for app-specific nouns", () => {
    const generated = buildClientDomainFiles({
      name: "customer success",
      system: "knowledge-brain",
      disposition: "extend",
      description: "Client-specific customer success workspace nouns.",
    });

    expect(generated).toMatchObject({
      name: "customerSuccess",
      pascalName: "CustomerSuccess",
    });
    expect(generated.files.map((file) => file.path)).toEqual([
      "generated/domains/customerSuccess/customerSuccess.domain.json",
      "generated/domains/customerSuccess/README.md",
      "docs/template/generated/provenance/add-client-domain/customerSuccess.json",
    ]);
    expect(JSON.parse(generated.files[0]?.content ?? "{}")).toMatchObject({
      domain: "customerSuccess",
      extensionBoundary: "generated-or-private-package",
      requiredFollowUp: expect.arrayContaining([
        "Map client nouns to source ownership and retention.",
      ]),
    });
  });

  it("lists canonical systems and resolves exact aliases before generation", () => {
    const all = runGeneratorCli(["systems"]);
    const auth = runGeneratorCli(["systems", "--query", "auth"]);
    const agentResource = runGeneratorCli([
      "systems",
      "--query",
      "present the editable Saas UI Pro Kanban block",
    ]);
    const unknown = runGeneratorCli([
      "systems",
      "--query",
      "parallel customer memory",
    ]);

    expect(JSON.parse(all.stdout)).toMatchObject({
      query: null,
      matches: expect.arrayContaining([
        expect.objectContaining({ id: "access-and-tenancy" }),
        expect.objectContaining({ id: "workflow-runtime" }),
      ]),
    });
    expect(JSON.parse(auth.stdout)).toMatchObject({
      matches: [expect.objectContaining({ id: "access-and-tenancy" })],
    });
    expect(JSON.parse(agentResource.stdout)).toMatchObject({
      matches: [expect.objectContaining({ id: "workflow-runtime" })],
      resources: [expect.objectContaining({ id: "route:$workspace/kanban" })],
    });
    expect(JSON.parse(unknown.stdout)).toMatchObject({
      matches: [],
      guidance: expect.stringContaining("introduce decision"),
    });
  });

  it("requires an active canonical system id before scaffolding", () => {
    const missing = runGeneratorCli([
      "add-capability",
      "--name",
      "parallel brain",
    ]);
    const alias = runGeneratorCli([
      "add-capability",
      "--name",
      "parallel brain",
      "--system",
      "rag",
    ]);
    const missingDisposition = runGeneratorCli([
      "add-capability",
      "--name",
      "parallel brain",
      "--system",
      "knowledge-brain",
    ]);

    expect(missing).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("Missing required --system"),
    });
    expect(alias).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("Unknown canonical system"),
    });
    expect(missingDisposition).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("Missing required --disposition"),
    });
  });

  it("writes client domain scaffolds through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-domain-"));

    try {
      const result = runGeneratorCli(
        [
          "add-client-domain",
          "--name",
          "customer success",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--description",
          "Client-specific customer success workspace nouns.",
          "--write",
        ],
        cwd,
      );
      const domainPath = join(
        cwd,
        "generated/domains/customerSuccess/customerSuccess.domain.json",
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(domainPath)).toBe(true);
      expect(JSON.parse(readFileSync(domainPath, "utf8"))).toMatchObject({
        domain: "customerSuccess",
        sourceTypes: ["markdown", "link", "note"],
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this generated capability contract assertion.
  it("builds Confect-oriented capability generator files", () => {
    const generated = buildCapabilityFiles({
      name: "summarize source",
      system: "knowledge-brain",
      disposition: "extend",
      description: "Summarizes an approved source set.",
      exposure: "headless",
    });

    expect(generated).toMatchObject({
      name: "summarizeSource",
      pascalName: "SummarizeSource",
      system: "knowledge-brain",
      disposition: "extend",
      exposure: "headless",
    });
    expect(generated.files.map((file) => file.path)).toEqual([
      "packages/convex/confect/capabilities/summarizeSource.spec.ts",
      "packages/convex/confect/capabilities/summarizeSource.impl.ts",
      "packages/convex/confect/capabilities/summarizeSource.domain.ts",
      "packages/convex/confect/capabilities/summarizeSource.test.ts",
      "packages/convex/confect/capabilities/summarizeSource.headless.json",
      "docs/template/generated/capabilities/summarizeSource.md",
      "docs/template/generated/provenance/add-capability/summarizeSource.json",
    ]);
    expect(generated.files[0]?.content).toContain(
      "FunctionSpec.publicMutation",
    );
    expect(generated.files[0]?.content).toContain(
      'import { Forbidden, Unauthorized, ValidationFailed } from "../errors"',
    );
    expect(generated.files[0]?.content).toContain("error: () =>");
    expect(generated.files[0]?.content).toContain(
      "Schema.Union(Unauthorized, ValidationFailed, Forbidden)",
    );
    expect(generated.files[0]?.content).not.toContain("errors: () =>");
    expect(generated.files[0]?.content).not.toContain("Schema.TaggedStruct");
    expect(generated.files[2]?.content).toContain(
      "normalizeSummarizeSourceInput",
    );
    expect(generated.files.map((file) => file.content).join("\n")).not.toMatch(
      /placeholder|stub/i,
    );
    expect(generated.files[1]?.content).toContain(
      'import summarizeSourceGroup from "./summarizeSource.spec"',
    );
    expect(generated.files[1]?.content).not.toContain(", { summarizeSource }");
    expect(generated.files[3]?.content).toContain(
      'import fc from "fast-check"',
    );
    expect(generated.files[3]?.content).toContain("fc.assert");
    expect(generated.files[3]?.content).toContain(
      'import metadata from "./summarizeSource.headless.json"',
    );
    expect(generated.files[3]?.content).not.toContain(
      "JSON.stringify(typedErrors)",
    );
    expect(generated.files[3]?.content).not.toContain(
      'expect(["Unauthorized","ValidationFailed","Forbidden"])',
    );
    expect(generated.files[3]?.content).toContain("metadata.typedErrors");
    expect(generated.files[3]?.content).toContain("summarizeSourceArgs");
    expect(generated.files[3]?.content).toContain("summarizeSourceReturns");
    expect(generated.files[4]?.content).toContain('"surfaces"');
    expect(JSON.parse(generated.files[4]?.content ?? "{}")).toMatchObject({
      system: "knowledge-brain",
      disposition: "extend",
      requiredFiles: expect.arrayContaining([
        "Confect spec/impl",
        "tests",
        "headless registry entry",
      ]),
      migrationNotes: expect.any(Array),
      frontendAdapter: "required when exposure is web",
    });
    expect(JSON.parse(generated.files[6]?.content ?? "{}")).toMatchObject({
      ownership: {
        system: "knowledge-brain",
        disposition: "extend",
      },
    });
  });

  it("writes generated capability files through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-capability-"));

    try {
      const result = runGeneratorCli(
        [
          "add-capability",
          "--name",
          "summarize source",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--description",
          "Summarizes an approved source set.",
          "--write",
        ],
        cwd,
      );
      const specPath = join(
        cwd,
        "packages/convex/confect/capabilities/summarizeSource.spec.ts",
      );
      const metadataPath = join(
        cwd,
        "packages/convex/confect/capabilities/summarizeSource.headless.json",
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(specPath)).toBe(true);
      expect(readFileSync(specPath, "utf8")).toContain("summarizeSourceArgs");
      expect(JSON.parse(readFileSync(metadataPath, "utf8"))).toMatchObject({
        capability: "summarizeSource",
        surfaces: ["api", "cli", "mcp"],
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds a durable table with ownership, lifecycle metadata, and a migration decision", () => {
    const generated = buildTableFiles({
      name: "source reviews",
      system: "knowledge-brain",
      disposition: "extend",
      tenantScope: "workspace",
      sensitivity: "confidential",
      pii: ["identity", "customer-content"],
      exportMode: "json",
      deleteMode: "delete",
      retention: "retain-until-workspace-delete",
      businessEntity: true,
      description: "Stores source review decisions.",
    });

    expect(generated).toMatchObject({
      name: "sourceReviews",
      system: "knowledge-brain",
      disposition: "extend",
    });
    expect(generated.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "packages/convex/confect/tables/sourceReviews.ts",
        "docs/template/schema-decisions/sourceReviews.md",
        "docs/template/system-catalog.json",
        "docs/template/data-resources.json",
        "docs/template/generated/provenance/add-table/sourceReviews.json",
      ]),
    );
    expect(generated.files[0]?.content).toContain(
      'workspaceId: Id("workspaces")',
    );
    expect(generated.files[0]?.content).toContain("title: Schema.String");
    expect(generated.files[0]?.content).toContain(
      'status: Schema.Literals(["planned", "active", "complete"])',
    );

    const systemCatalogFile = generated.files.find(
      ({ path }) => path === "docs/template/system-catalog.json",
    );
    const systemCatalog = JSON.parse(systemCatalogFile?.content ?? "{}") as {
      readonly systems: readonly {
        readonly id: string;
        readonly tables: readonly string[];
      }[];
    };
    expect(
      systemCatalog.systems.find(({ id }) => id === "knowledge-brain")?.tables,
    ).toContain("sourceReviews");

    const dataCatalogFile = generated.files.find(
      ({ path }) => path === "docs/template/data-resources.json",
    );
    const dataCatalog = JSON.parse(dataCatalogFile?.content ?? "{}") as {
      readonly resources: readonly Record<string, unknown>[];
    };
    expect(dataCatalog.resources).toContainEqual(
      expect.objectContaining({
        id: "sourceReviews",
        system: "knowledge-brain",
        tenantScope: "workspace",
        workspaceLifecycle: "managed",
        retention: "retain-until-workspace-delete",
      }),
    );
  });

  it("rejects incomplete or non-extension table generation", () => {
    const reuse = runGeneratorCli([
      "add-table",
      "--name",
      "source reviews",
      "--system",
      "knowledge-brain",
      "--disposition",
      "reuse",
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
    ]);
    const incomplete = runGeneratorCli([
      "add-table",
      "--name",
      "source reviews",
      "--system",
      "knowledge-brain",
      "--disposition",
      "extend",
    ]);

    expect(reuse).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("must use --disposition extend"),
    });
    expect(incomplete).toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("Missing required --tenant-scope"),
    });
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this generated workflow contract assertion.
  it("builds workflow generator files with durable Confect contracts", () => {
    const generated = buildWorkflowFiles({
      name: "source grounded plan",
      system: "knowledge-brain",
      disposition: "extend",
      description: "Builds a sourced plan with approval and receipt.",
    });

    expect(generated).toMatchObject({
      name: "sourceGroundedPlan",
      pascalName: "SourceGroundedPlan",
    });
    expect(generated.files.map((file) => file.path)).toEqual([
      "packages/convex/confect/workflowContracts/sourceGroundedPlan.spec.ts",
      "packages/convex/confect/workflowContracts/sourceGroundedPlan.impl.ts",
      "packages/convex/confect/workflows/sourceGroundedPlan/v1.graph.ts",
      "packages/convex/confect/workflows/sourceGroundedPlan/v1.registry.ts",
      "packages/convex/confect/workflows/sourceGroundedPlan.predeploy.ts",
      "packages/convex/confect/workflowRunners/sourceGroundedPlan/v1.ts",
      "packages/convex/confect/workflowRunners/sourceGroundedPlan/v1.spec.ts",
      "packages/convex/confect/workflowRunners/sourceGroundedPlan/v1.impl.ts",
      "packages/convex/test/sourceGroundedPlan.workflow.test.ts",
      "docs/template/generated/workflows/sourceGroundedPlan.semantics.json",
      "docs/template/generated/workflows/sourceGroundedPlan.md",
      "docs/template/generated/provenance/add-workflow/sourceGroundedPlan.json",
    ]);
    expect(generated.files[5]?.path).toBe(
      "packages/convex/confect/workflowRunners/sourceGroundedPlan/v1.ts",
    );
    const spec = generated.files[0]?.content ?? "";
    const impl = generated.files[1]?.content ?? "";
    const graph = generated.files[2]?.content ?? "";
    const registry = generated.files[3]?.content ?? "";
    const predeploy = generated.files[4]?.content ?? "";
    const convexWorkflow = generated.files[5]?.content ?? "";
    const runnerSpec = generated.files[6]?.content ?? "";
    const runnerImpl = generated.files[7]?.content ?? "";
    const semantics = generated.files[9]?.content ?? "";
    const docs = generated.files[10]?.content ?? "";

    expect(registry).toContain("defineWorkflowCapabilityRegistry");
    expect(registry).toContain("buildWorkflowCapabilityArgs");
    expect(registry).toContain("sourceGroundedPlanCapabilityArgs");
    expect(registry).toContain("runWorkflowCapabilityBoundary");
    expect(registry).toContain("sourceGroundedPlanCapabilityBoundary");
    expect(registry).toContain("sourceGroundedPlanConsequentialAuthority");
    expect(registry).toContain("sourceGroundedPlanArtifactRefs");
    expect(registry).toContain("refs.internal.workflows.artifacts.put");
    expect(registry).toContain("refs.internal.workflows.artifacts.getOwned");
    expect(registry).toContain("defineEmptyWorkflowV2SubworkflowRegistry");
    expect(registry).toContain("defineWorkflowV2EventRegistry");
    expect(registry).toContain("defineWorkflowEvent");
    expect(registry).toContain("sourceGroundedPlanApprovalDecisionEvent");
    expect(registry).toContain(
      "validator: v.object({ approved: v.boolean() })",
    );
    expect(registry).toContain("generatedWorkflowSubworkflowPolicy");
    expect(registry).toContain(
      "refs.internal.workflows.subworkflowLinks.reserve",
    );
    expect(registry).toContain(
      "refs.internal.workflows.subworkflowLinks.reconcile",
    );
    for (const reference of [
      "workflows/subworkflowLinksCurrent:recoverReservation",
      "workflows/subworkflowLinksCurrent:persistUnresolvedReservation",
      "workflows/subworkflowLinksCurrent:persistUnresolvedSuccess",
      "workflows/subworkflowLinksCurrent:recoverUnresolvedSuccess",
      "workflows/subworkflowLinksCurrent:resolveUnresolvedSuccess",
      "workflows/subworkflowLinksCurrent:reportReconciliationFailure",
    ]) {
      expect(registry).toContain(reference);
    }
    expect(registry).toContain(
      "refs.internal.workflows.eventInstances.allocate",
    );
    expect(registry).toContain(
      "refs.internal.workflows.eventInstances.reconcile",
    );
    expect(registry).toContain("Ref.getFunctionReference");
    expect(registry).toContain("components.workflow.journal.load");
    expect(registry).toContain("components.workflow.event.create");
    expect(convexWorkflow).toContain("eventRegistry:");
    expect(spec).toContain('name: "sendEvent"');
    expect(spec).toContain('name: "cancel"');
    expect(spec).toContain('name: "restart"');
    expect(spec).toContain('name: "listSteps"');
    expect(spec).toContain('name: "cleanup"');
    expect(spec).toContain('kind: Schema.Literal("id")');
    expect(spec).toContain('kind: Schema.Literal("definition")');
    expect(spec).not.toContain("const ApproveArgs");
    expect(impl).toContain("refs.internal.workflows.eventInstances.send");
    expect(impl).toContain("validateWorkflowEventDelivery");
    expect(impl).not.toContain("nodeId");
    expect(registry).toContain("internal refs");
    expect(registry).toContain("dedupe/restart horizons");
    expect(registry).toContain("guard postures");
    expect(registry).toContain("redaction policy");
    expect(registry).toContain("fixture evidence");
    expect(registry).toContain("defineWorkflowRoleGrantPolicy");
    expect(registry).toContain(
      "runner,\n * not an entry or caller, owns the fixed current-authority query ref",
    );
    expect(registry).not.toContain(
      'boundary: "generated-current-authority", ref',
    );
    expect(spec).toContain("export const authorizeConsequential");
    expect(spec).toContain("returns: () => WorkflowCurrentAuthorityReceipt");
    expect(impl).toContain("requireConsequentialWorkflowAuthority(");
    expect(impl).toContain("sourceGroundedPlanCurrentGrantPolicy");

    expect(spec).toContain("defineContractFunction");
    expect(spec).toContain("export const manifest");
    expect(spec).toContain("export const schemaRegistry");
    expect(spec).toContain(
      'operationId: "workflows.sourceGroundedPlan.startInteractive"',
    );
    expect(spec).toContain(
      'operationId: "workflows.sourceGroundedPlan.startQueued"',
    );
    expect(spec).toContain(
      'argsSchemaName: "workflows.sourceGroundedPlan.startInteractive.args"',
    );
    expect(spec).toContain(
      'returnsSchemaName: "workflows.sourceGroundedPlan.startInteractive.returns"',
    );
    expect(spec).toContain(
      'argsSchemaName: "workflows.sourceGroundedPlan.status.args"',
    );
    expect(spec).toContain(
      'returnsSchemaName: "workflows.sourceGroundedPlan.status.returns"',
    );
    expect(spec).toContain(
      'argsSchemaName: "workflows.sourceGroundedPlan.sendEvent.args"',
    );
    expect(spec).toContain(
      'returnsSchemaName: "workflows.sourceGroundedPlan.sendEvent.returns"',
    );
    expect(spec).toContain("WorkflowStatusResult");

    expect(impl).toContain("startWorkflowAndRecordOwnership");
    expect(impl).toContain("createWorkflowUserPrincipal");
    expect(impl).toContain("resolveWorkflowPolicySnapshotForRun");
    expect(impl).toContain('from "../workflows/_kit/policySnapshotCurrent"');
    expect(impl).toContain("Effect.mapError(toWorkflowPolicyValidationFailed)");
    expect(impl).toContain("readonly principal: DurableWorkflowPrincipal");
    expect(impl).toContain("readonly policySnapshot: WorkflowPolicySnapshot");
    expect(impl).not.toContain(
      'readonly version: 1;\n      readonly kind: "user"',
    );
    expect(impl).toContain("principalSnapshot: principal");
    expect(impl).toContain("policySnapshot,");
    expect(impl).not.toContain("authEpoch: 1");
    expect(impl).toContain("onCompleteRef: sourceGroundedPlanOnCompleteRef");
    expect(impl).toContain("refs.internal.workflows.lifecycle.restart");
    expect(impl).toContain("refs.internal.workflows.lifecycle.cleanup");
    expect(impl).toContain("makeFunctionReference");
    expect(impl).toContain('"workflowRunners/sourceGroundedPlan/v1:run"');
    expect(impl).not.toContain('"workflows/sourceGroundedPlan:run"');
    expect(impl).not.toContain("../../convex/_generated/api");
    expect(impl).toContain("toWorkflowValidationFailed");
    expect(impl).toContain("Effect.mapError(toWorkflowError)");
    expect(impl).toContain("Effect.mapError(toWorkflowValidationFailed)");
    expect(impl).not.toContain("workflowArgs:");
    expect(impl).toContain("buildWorkflowArgs: (workflowRunId) =>");
    expect(impl).toContain("workflowRunId,");
    expect(impl).toContain("startedAt:");
    expect(impl).toContain("const runProjection = {");
    expect(impl).toContain("...(run.timeoutSummary !== undefined");
    expect(impl).toContain("...(run.lifecycleGeneration !== undefined");
    expect(impl).toContain("...(run.componentResidualState !== undefined");
    expect(impl).toContain(
      "return projectWorkflowStatus(rawStatus, runProjection)",
    );
    expect(impl).not.toContain("return projectWorkflowStatus(rawStatus, run)");
    expect(impl).not.toMatch(/\bargs:\s*\{ workspaceId, idempotencyKey \}/);
    expect(impl).not.toContain("now:");

    expect(convexWorkflow).toContain("defineMaestroWorkflow");
    expect(convexWorkflow).toContain("adaptPinnedWorkflowStep");
    expect(convexWorkflow).toContain(
      "runDurableGraphWorkflowV2(adaptPinnedWorkflowStep(step),",
    );
    expect(convexWorkflow).not.toContain("step as RunDurableGraphStep");
    expect(convexWorkflow).toContain("export const onComplete");
    expect(convexWorkflow).toContain("reconcileObservedWorkflowCompletion");
    expect(convexWorkflow).toContain("runDurableGraphWorkflow");
    expect(convexWorkflow).toContain("DurableWorkflowPrincipalValidator");
    expect(convexWorkflow).toContain("WorkflowPolicySnapshotValidator");
    expect(convexWorkflow).not.toContain("const WorkflowPrincipalValidator");
    expect(convexWorkflow).not.toContain(
      "const WorkflowPolicySnapshotValidator",
    );
    expect(convexWorkflow).not.toContain("policySnapshot: args.policySnapshot");
    expect(convexWorkflow).toContain("WorkflowReceiptValidator");
    expect(convexWorkflow).toContain(
      "principal: DurableWorkflowPrincipalValidator",
    );
    expect(convexWorkflow).toContain("defineGeneratedCurrentAuthorityBinding");
    expect(convexWorkflow).not.toContain("defineGeneratedCurrentAuthorityRef");
    expect(convexWorkflow).toContain(
      "refs.internal.workflowContracts.sourceGroundedPlan.authorizeConsequential",
    );
    expect(convexWorkflow).toContain("currentAuthority,");
    const graphRunnerV2 = readFileSync(
      join(
        repoRoot,
        "packages/convex/confect/workflows/_kit/graphRunnerV2Current.ts",
      ),
      "utf8",
    );
    expect(graphRunnerV2).not.toContain(
      "export const defineGeneratedCurrentAuthorityRef",
    );
    expect(graphRunnerV2).toContain("generatedWorkflowContractRefs: object");
    const graphRunner = readFileSync(
      join(
        repoRoot,
        "packages/convex/confect/workflows/_kit/graphRunnerCurrent.ts",
      ),
      "utf8",
    );
    expect(graphRunner).toContain("step: MaestroWorkflowContext");
    expect(graphRunner).toContain("options === undefined");
    expect(graphRunner).toContain("step.runAction(ref, args, options)");
    expect(convexWorkflow).toContain("returns: WorkflowReceiptValidator");
    expect(convexWorkflow).not.toContain("returns: v.any()");
    expect(convexWorkflow).toContain("metadata");
    expect(convexWorkflow).not.toContain("failureRoutes");
    expect(convexWorkflow).not.toContain("GeneratedFailurePolicy");
    expect(convexWorkflow).toContain("sourceGroundedPlanSubworkflowRegistry");
    expect(convexWorkflow).toContain("sourceGroundedPlanSubworkflowPolicy");
    expect(convexWorkflow).toContain("SubworkflowExecutionContextValidator");
    expect(convexWorkflow).toContain(
      "refs.internal.workflows.subworkflowLinks.activate",
    );
    expect(convexWorkflow).toContain(
      "subworkflow: v.optional(SubworkflowExecutionContextValidator)",
    );
    expect(convexWorkflow).toContain("activateSubworkflowRef");
    expect(convexWorkflow).toContain("bindObservedWorkflowAuthority");
    expect(convexWorkflow).toContain(
      "const executionArgs = bindObservedWorkflowAuthority(args, executionIdentity)",
    );
    expect(convexWorkflow).toContain("inputs: executionArgs");
    expect(convexWorkflow).toContain("principal: executionArgs.principal");
    expect(convexWorkflow).toContain(
      "policySnapshot: executionArgs.policySnapshot",
    );
    expect(convexWorkflow).toContain("workflowRunId: args.workflowRunId");
    expect(convexWorkflow).toContain(
      "refs.internal.workflows.stageObservations",
    );
    expect(convexWorkflow).toContain(
      "generation: executionIdentity.generation",
    );
    expect(convexWorkflow).toContain(
      "occurredAt: executionIdentity.observedAt",
    );
    expect(convexWorkflow).not.toContain("generation: 0");
    expect(convexWorkflow).toContain("stageObservations.recordStarted");
    expect(convexWorkflow).toContain(
      "observability: { recordStageStarted, recordStageFinished }",
    );
    expect(predeploy).toContain(
      "collectSourceGroundedPlanWorkflowWorkpoolDeclarations",
    );
    expect(predeploy).toContain("workflowWorkpoolConfigurationFindings(");
    expect(predeploy).toContain("Workflow predeploy generation failed");
    expect(runnerSpec).toContain("FunctionSpec.convexInternalMutation");
    expect(runnerSpec).toContain('("onComplete")');
    expect(runnerImpl).toContain("FunctionImpl.make");
    expect(semantics).toContain('"WF-DEFINE"');
    expect(semantics).toContain('"posture": "generated"');
    expect(semantics).toContain('"WF-NODE-RETRY"');
    expect(semantics).toContain('"posture": "guarded-default"');
    expect(semantics).toContain('"WF-NODE-EVENT-DEFINITION"');
    expect(semantics).toContain('"WF-NODE-EVENT-SCHEMA"');
    expect(semantics).toContain('"WF-NODE-EVENT-INSTANCE"');
    expect(semantics).toContain('"WF-STEP-EVENT"');
    expect(semantics).toContain('"WF-SEND-EVENT"');
    expect(semantics).toContain('"WF-CREATE-EVENT"');
    expect(semantics).toContain(
      '"compiler": "internal persisted generation allocation only"',
    );
    expect(JSON.parse(semantics)).toMatchObject(
      Object.fromEntries(
        [
          "WF-NODE-TRANSACTION",
          "WF-TRANSACTION-KIND",
          "WF-TRANSACTION-LIMITS",
          "WF-TRANSACTION-BYTES-READ",
          "WF-TRANSACTION-BYTES-WRITTEN",
          "WF-TRANSACTION-DATABASE-QUERIES",
          "WF-TRANSACTION-DOCUMENTS-READ",
          "WF-TRANSACTION-DOCUMENTS-WRITTEN",
          "WF-TRANSACTION-FUNCTIONS-SCHEDULED",
          "WF-TRANSACTION-SCHEDULED-FUNCTION-ARGS-BYTES",
        ].map((id) => [id, { posture: "guarded-default" }]),
      ),
    );
    expect(semantics).not.toContain('"WF-HANDLER-DATE"');

    expect(graph).toContain("defineWorkflowGraphV2");
    expect(graph).toContain("defineWorkflowReferenceRegistry");
    expect(graph).toContain("version: 2");
    expect(graph).toContain('stepName: "start.v2"');
    expect(graph).toContain('name: "interactive"');
    expect(graph).toContain('name: "queued"');
    expect(graph).toContain('kind: "source"');
    expect(graph).toContain('kind: "output"');
    expect(graph).not.toContain('kind: "capability"');
    expect(graph).not.toContain('kind: "approval"');
    expect(registry).toContain("independent Workpool transaction");
    expect(registry).not.toContain("transactionLimits:");

    expect(docs).toContain(
      "packages/convex/confect/workflowRunners/sourceGroundedPlan/v1.ts",
    );
    expect(docs).toContain("immutable-version Confect-owned runner source");
    expect(docs).not.toContain("packages/convex/convex/workflows/");
    expect(docs).toContain("pnpm confect:codegen");
    expect(docs).toContain("pnpm --dir packages/convex exec convex codegen");
    expect(docs).toContain("workflowContracts.sourceGroundedPlan.sendEvent");
    expect(docs).toContain(
      "concrete `buildArgs` and logical instance-key mappers",
    );
    expect(docs).toContain("`tiny` or `small-atomic`");
    expect(docs).toContain("reviewed advanced constructor");
    expect(docs).toContain("cycle, depth, and fan-out checks");
    expect(docs).toContain("stable generated runner-reference identity");
    expect(docs).toContain("stable mapper/result export descriptors");
    expect(docs).toContain(
      "The child registry exposes reserve, reconcile, and reconciliation-failure reporting only",
    );
    expect(docs).toContain(
      "Cascade cancellation and cleanup remain restricted",
    );
    expect(docs).toContain("scheduled children remain rejected");
    expect(docs).toContain("already-running action may finish");
    expect(docs).toContain("never claims full component deletion");
    expect(spec).toContain("startInteractive");
    expect(spec).toContain("startQueued");
    expect(spec).not.toContain("kickoffMode");
    expect(impl).toContain('startWithProfile("interactive"');
    expect(impl).toContain('startWithProfile("queued"');
    expect(impl).toContain('kickoffProfile === "interactive"');
    expect(impl).toContain('from "../workflows/_kit/defineMaestroWorkflow"');
    expect(impl).not.toContain('from "@convex-dev/workflow"');
    expect(impl).toContain("preserveWorkflowStartErrors = <A, E, R>");
    expect(impl).toContain("resolveWorkflowPolicySnapshotForRun");
    expect(impl).not.toContain('policyPosture.kind !== "none"');
    expect(impl).toContain("principal:");
    expect(impl).toContain("actorId: access.userId");
  });

  it("writes generated workflow files through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-workflow-"));

    try {
      const result = runGeneratorCli(
        [
          "add-workflow",
          "--name",
          "source grounded plan",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--description",
          "Builds a sourced plan with approval and receipt.",
          "--write",
        ],
        cwd,
      );
      const specPath = join(
        cwd,
        "packages/convex/confect/workflowContracts/sourceGroundedPlan.spec.ts",
      );
      const graphPath = join(
        cwd,
        "packages/convex/confect/workflows/sourceGroundedPlan/v1.graph.ts",
      );
      const workflowPath = join(
        cwd,
        "packages/convex/confect/workflowRunners/sourceGroundedPlan/v1.ts",
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(specPath)).toBe(true);
      expect(existsSync(graphPath)).toBe(true);
      expect(existsSync(workflowPath)).toBe(true);
      expect(readFileSync(specPath, "utf8")).toContain(
        "workflows.sourceGroundedPlan.start",
      );
      expect(readFileSync(graphPath, "utf8")).toContain(
        "sourceGroundedPlanGraph",
      );
      expect(readFileSync(workflowPath, "utf8")).toContain(
        "runDurableGraphWorkflow",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds a neutral agent declaration without an invented seat", () => {
    const generated = buildAgentFiles({
      name: "workflow architect",
      system: "workflow-runtime",
      disposition: "reuse",
      description: "Drafts reviewed workflow plans from approved context.",
    });

    expect(generated).toMatchObject({
      name: "workflowArchitect",
      pascalName: "WorkflowArchitect",
      surfaces: [],
      headlessExposure: false,
    });
    expect(generated.files.map((file) => file.path)).toEqual([
      "packages/convex/confect/agents/workflowArchitect.ts",
      "docs/template/generated/agents/workflowArchitect.md",
      "docs/template/generated/provenance/add-agent/workflowArchitect.json",
    ]);
    expect(
      generated.files.some((file) => file.path.endsWith(".headless.json")),
    ).toBe(false);

    const declaration = generated.files[0]?.content ?? "";
    const docs = generated.files[1]?.content ?? "";
    expect(declaration).toContain("surfaces: []");
    expect(declaration).toContain("capabilities: []");
    expect(declaration).not.toContain("FunctionSpec");
    expect(docs).toContain("select a UI seat");
  });

  it("keeps the explicit agent-seat command distinct from neutral add-agent", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-agent-"));

    try {
      const result = runGeneratorCli(
        [
          "add-agent",
          "--name",
          "workflow architect",
          "--system",
          "workflow-runtime",
          "--disposition",
          "reuse",
          "--description",
          "Drafts reviewed workflow plans from approved context.",
          "--write",
        ],
        cwd,
      );
      const aliasResult = runGeneratorCli([
        "add-agent-seat",
        "--name",
        "workflow architect",
        "--system",
        "workflow-runtime",
        "--disposition",
        "reuse",
        "--description",
        "Drafts reviewed workflow plans from approved context.",
      ]);
      const parsed = JSON.parse(result.stdout) as {
        readonly files: readonly { readonly path: string }[];
        readonly surfaces: readonly string[];
        readonly headlessExposure: boolean;
      };
      const aliasParsed = JSON.parse(aliasResult.stdout) as {
        readonly files: readonly { readonly path: string }[];
        readonly surfaces: readonly string[];
        readonly headlessExposure: boolean;
      };
      const specPath = join(
        cwd,
        "packages/convex/confect/agents/workflowArchitect.spec.ts",
      );
      const toolsPath = join(
        cwd,
        "packages/convex/confect/agents/workflowArchitect.tools.ts",
      );
      const docsPath = join(
        cwd,
        "docs/template/generated/agents/workflowArchitect.md",
      );

      expect(result.exitCode).toBe(0);
      expect(aliasResult.exitCode).toBe(0);
      expect(parsed.files.map((file) => file.path)).not.toEqual(
        aliasParsed.files.map((file) => file.path),
      );
      expect(parsed.surfaces).toEqual([]);
      expect(aliasParsed.surfaces).toEqual(["web"]);
      expect(parsed.headlessExposure).toBe(false);
      expect(aliasParsed.headlessExposure).toBe(false);
      expect(existsSync(specPath)).toBe(false);
      expect(existsSync(toolsPath)).toBe(false);
      expect(existsSync(docsPath)).toBe(true);
      expect(aliasParsed.files.map(({ path }) => path)).toEqual(
        expect.arrayContaining([
          "packages/convex/confect/agents/workflowArchitect.spec.ts",
          "packages/convex/confect/agents/workflowArchitect.impl.ts",
          "packages/convex/confect/agents/workflowArchitect.tools.ts",
          "packages/convex/test/workflowArchitect.agent.test.ts",
        ]),
      );
      expect(readFileSync(docsPath, "utf8")).not.toContain(
        "headless registry entry",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("exposes a dedicated generated workflow output smoke gate", () => {
    const rootPackage = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    ) as { readonly scripts?: Record<string, string> };
    const smokeScriptPath = join(
      repoRoot,
      "tooling/generators/src/workflow-output-smoke.ts",
    );

    expect(rootPackage.scripts?.[workflowOutputSmokeScriptName]).toBe(
      "tsx tooling/generators/src/workflow-output-smoke.ts",
    );
    expect(rootPackage.scripts?.["template:add-agent"]).toBe(
      "tsx tooling/generators/src/cli.ts add-agent",
    );
    expect(rootPackage.scripts?.["template:add-agent-seat"]).toBe(
      "tsx tooling/generators/src/cli.ts add-agent-seat",
    );
    expect(existsSync(smokeScriptPath)).toBe(true);
    expect(smokeWorkflowName).toBe("generatedWorkflowSmoke");
    const smokeSource = readFileSync(smokeScriptPath, "utf8");
    expect(smokeSource).toContain("requiresDeployment");
    expect(smokeSource).toContain("Generated workflow runner is missing");
  });

  // eslint-disable-next-line complexity -- AP-008 tracks splitting this generated promotion contract assertion.
  it("builds production-target capability promotion files", () => {
    const promoted = buildCapabilityPromotionFiles({
      name: "summarize source",
      system: "knowledge-brain",
      disposition: "extend",
      description: "Summarizes an approved source set.",
    });

    expect(promoted).toMatchObject({
      name: "summarizeSource",
      pascalName: "SummarizeSource",
      target: "capability",
    });
    expect(promoted.files.map((file) => file.path)).toEqual([
      "packages/convex/confect/capabilities/summarizeSource.spec.ts",
      "packages/convex/confect/capabilities/summarizeSource.impl.ts",
      "packages/convex/confect/capabilities/summarizeSource.domain.ts",
      "packages/convex/confect/capabilities/summarizeSource.test.ts",
      "packages/convex/confect/capabilities/summarizeSource.headless.json",
      "docs/template/generated/capabilities/summarizeSource.md",
      "docs/template/generated/provenance/promote-capability/summarizeSource.json",
    ]);
    expect(promoted.files[0]?.content).toContain("FunctionSpec.publicMutation");
    expect(promoted.files[0]?.content).toContain(
      'import { Forbidden, Unauthorized, ValidationFailed } from "../errors"',
    );
    expect(promoted.files[1]?.content).toContain(
      'import databaseSchema from "../_generated/schema"',
    );
    expect(promoted.files[1]?.content).toContain(
      'import summarizeSourceGroup from "./summarizeSource.spec"',
    );
    expect(promoted.files[1]?.content).not.toContain(", { summarizeSource }");
    expect(promoted.files[2]?.content).toContain(
      "normalizeSummarizeSourceInput",
    );
    expect(promoted.files[3]?.content).toContain('import fc from "fast-check"');
    expect(promoted.files[3]?.content).toContain("fc.assert");
    expect(promoted.files[3]?.content).toContain(
      'import metadata from "./summarizeSource.headless.json"',
    );
    expect(promoted.files[3]?.content).not.toContain(
      "JSON.stringify(typedErrors)",
    );
    expect(promoted.files[3]?.content).not.toContain(
      'expect(["Unauthorized","ValidationFailed","Forbidden"])',
    );
    expect(promoted.files[3]?.content).toContain("metadata.typedErrors");
    expect(promoted.files[3]?.content).toContain("summarizeSourceArgs");
    expect(promoted.files[3]?.content).toContain("summarizeSourceReturns");
    expect(JSON.parse(promoted.files[4]?.content ?? "{}")).toMatchObject({
      migrationNotes: expect.arrayContaining([
        "Run Confect codegen before wiring generated refs.",
      ]),
      frontendAdapter: "required when exposed in web",
    });
    expect(promoted.followUp).toContain(
      "Run pnpm confect:codegen and inspect generated refs.",
    );
  });

  it("writes promoted capability files through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-promote-cap-"));

    try {
      const result = runGeneratorCli(
        [
          "promote-capability",
          "--name",
          "summarize source",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--description",
          "Summarizes an approved source set.",
          "--write",
        ],
        cwd,
      );
      const specPath = join(
        cwd,
        "packages/convex/confect/capabilities/summarizeSource.spec.ts",
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(specPath)).toBe(true);
      expect(readFileSync(specPath, "utf8")).toContain("summarizeSourceArgs");
      expect(JSON.parse(result.stdout)).toMatchObject({
        target: "capability",
        name: "summarizeSource",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds production-target workflow promotion files", () => {
    const promoted = buildWorkflowPromotionFiles({
      name: "source grounded plan",
      system: "knowledge-brain",
      disposition: "extend",
      description: "Builds a sourced plan with approval and receipt.",
    });

    expect(promoted).toMatchObject({
      name: "sourceGroundedPlan",
      pascalName: "SourceGroundedPlan",
      target: "workflow",
    });
    expect(promoted.files.map((file) => file.path)).toEqual([
      "packages/convex/confect/workflows/sourceGroundedPlan/sourceGroundedPlan.spec.ts",
      "packages/convex/confect/workflows/sourceGroundedPlan/sourceGroundedPlan.impl.ts",
      "packages/convex/confect/workflows/sourceGroundedPlan/sourceGroundedPlan.workflow.json",
      "packages/convex/confect/workflows/sourceGroundedPlan/README.md",
      "docs/template/generated/provenance/promote-workflow/sourceGroundedPlan.json",
    ]);
    expect(promoted.files[0]?.content).toContain("FunctionSpec.publicMutation");
    expect(promoted.files[2]?.content).toContain('"promoted": true');
    expect(JSON.parse(promoted.files[2]?.content ?? "{}")).toMatchObject({
      migrationNotes: expect.arrayContaining([
        "Keep React Flow view data derived from this durable graph.",
      ]),
      frontendAdapter: "packages/workflow-ui derived graph adapter",
      headlessRegistry: "required",
    });
    expect(promoted.followUp).toContain(
      "Run pnpm confect:codegen and inspect generated refs.",
    );
  });

  it("writes promoted workflow files through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-promote-flow-"));

    try {
      const result = runGeneratorCli(
        [
          "promote-workflow",
          "--name",
          "source grounded plan",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--description",
          "Builds a sourced plan with approval and receipt.",
          "--write",
        ],
        cwd,
      );
      const graphPath = join(
        cwd,
        "packages/convex/confect/workflows/sourceGroundedPlan/sourceGroundedPlan.workflow.json",
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(graphPath)).toBe(true);
      expect(JSON.parse(readFileSync(graphPath, "utf8"))).toMatchObject({
        id: "sourceGroundedPlan",
        promoted: true,
      });
      expect(JSON.parse(result.stdout)).toMatchObject({
        target: "workflow",
        name: "sourceGroundedPlan",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds a client-fork upgrade report", () => {
    const report = buildTemplateUpgradeReport({
      from: "client-v1.0.0",
      to: "template-v1.1.0",
    });

    expect(report).toMatchObject({
      from: "client-v1.0.0",
      to: "template-v1.1.0",
      ok: true,
      changedPackages: expect.arrayContaining([
        "packages/convex",
        "packages/integrations",
      ]),
      envChanges: expect.arrayContaining([expect.stringContaining("WorkOS")]),
      generatedContractDiffs: expect.arrayContaining([
        expect.stringContaining("OpenAPI"),
      ]),
      privatePackageCompatibility: expect.arrayContaining([
        expect.stringContaining("private-packages"),
      ]),
      commands: expect.arrayContaining([
        "pnpm review:readiness",
        "pnpm check:confect-contracts",
      ]),
    });
  });

  it("builds a private package dry-run plan from a fixture manifest", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-private-"));
    const fixture = join(cwd, "fixtures/generic-ai-ops");

    try {
      mkdirSync(fixture, { recursive: true });
      writeFileSync(
        join(fixture, "template-package.json"),
        JSON.stringify({
          name: "generic-ai-ops",
          capabilities: ["summarizeSource", "draftPlan"],
          workflows: ["sourceGroundedPlan"],
          agents: ["planner"],
          docs: ["README.md", "playbook.md"],
        }),
        { flag: "w" },
      );

      const plan = buildPrivatePackagePlan({
        fixturePath: fixture,
        system: "knowledge-brain",
        disposition: "extend",
      });

      expect(plan).toMatchObject({
        mode: "dry-run",
        ok: true,
        packageName: "generic-ai-ops",
        files: expect.arrayContaining([
          expect.objectContaining({
            path: "private-packages/generic-ai-ops/package-plan.json",
          }),
          expect.objectContaining({
            path: "private-packages/generic-ai-ops/src/index.ts",
          }),
          expect.objectContaining({
            path: "private-packages/generic-ai-ops/src/capabilities/summarizeSource/summarizeSource.contract.json",
          }),
          expect.objectContaining({
            path: "private-packages/generic-ai-ops/src/workflows/sourceGroundedPlan/sourceGroundedPlan.workflow.json",
          }),
        ]),
      });
      expect(plan.checks).toContainEqual(
        expect.objectContaining({
          id: "fixture:manifest",
          status: "pass",
        }),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("imports a recomputed private package plan through the root CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-private-import-"));
    const fixture = join(cwd, "fixtures/generic-ai-ops");

    try {
      mkdirSync(fixture, { recursive: true });
      writeFileSync(
        join(fixture, "template-package.json"),
        JSON.stringify({
          name: "generic-ai-ops",
          capabilities: ["summarizeSource"],
          workflows: ["sourceGroundedPlan"],
        }),
        { flag: "w" },
      );

      const dryRun = runGeneratorCli(
        [
          "private-package:dry-run",
          "--fixture",
          "fixtures/generic-ai-ops",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
        ],
        cwd,
      );
      const planPath = join(
        cwd,
        "private-packages/generic-ai-ops/package-plan.json",
      );
      const indexPath = join(
        cwd,
        "private-packages/generic-ai-ops/src/index.ts",
      );
      const capabilityPath = join(
        cwd,
        "private-packages/generic-ai-ops/src/capabilities/summarizeSource/summarizeSource.contract.json",
      );
      const workflowPath = join(
        cwd,
        "private-packages/generic-ai-ops/src/workflows/sourceGroundedPlan/sourceGroundedPlan.workflow.json",
      );

      expect(dryRun.exitCode).toBe(0);
      expect(JSON.parse(dryRun.stdout)).toMatchObject({
        mode: "dry-run",
        packageName: "generic-ai-ops",
        collisions: [],
        privacy: {
          reads: ["template-package.json"],
          readsSeedData: false,
          readsSecrets: false,
          productionRegistrations: false,
        },
      });
      expect(JSON.parse(dryRun.stdout)).toMatchObject({
        confirmationCommand:
          'pnpm template:private-package:import -- --fixture "fixtures/generic-ai-ops" --system "knowledge-brain" --disposition extend --write',
      });
      expect(existsSync(planPath)).toBe(false);
      const imported = runGeneratorCli(
        [
          "private-package:import",
          "--fixture",
          "fixtures/generic-ai-ops",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--write",
        ],
        cwd,
      );
      expect(imported.exitCode).toBe(0);
      expect(existsSync(planPath)).toBe(true);
      expect(existsSync(indexPath)).toBe(true);
      expect(existsSync(capabilityPath)).toBe(true);
      expect(existsSync(workflowPath)).toBe(true);
      expect(JSON.parse(readFileSync(planPath, "utf8"))).toMatchObject({
        packageName: "generic-ai-ops",
        reviewBoundary: "private-packages-first",
        contractReview: "required-before-promotion",
        system: "knowledge-brain",
        disposition: "extend",
        productionRegistrations: false,
        ownershipNotes: expect.arrayContaining([
          "Assign a client/package owner before promotion.",
        ]),
        migrationNotes: expect.arrayContaining([
          "Do not promote directly into template core.",
        ]),
        requiredChecks: expect.arrayContaining(["pnpm check:secret-canaries"]),
      });
      expect(
        imported.stdout.includes("packages/convex/confect/capabilities"),
      ).toBe(false);
      expect(readFileSync(indexPath, "utf8")).toContain("privatePackage");
      expect(JSON.parse(readFileSync(capabilityPath, "utf8"))).toMatchObject({
        capability: "summarizeSource",
        promotionCommand:
          "pnpm template:promote-capability -- --name summarizeSource --system knowledge-brain --disposition extend --write",
      });
      expect(JSON.parse(readFileSync(workflowPath, "utf8"))).toMatchObject({
        workflow: "sourceGroundedPlan",
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "source" }),
          expect.objectContaining({ id: "receipt" }),
        ]),
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("requires canonical ownership before importing private packages", () => {
    const result = runGeneratorCli([
      "private-package:import",
      "--fixture",
      "examples/generic-ai-ops",
      "--write",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing required --system");
  });

  it("scaffolds prototypes only inside the experiment boundary", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-prototype-"));

    try {
      const result = runGeneratorCli(
        [
          "prototype",
          "--name",
          "memoryLab",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--hypothesis",
          "A bounded memory view improves grounded answers.",
          "--write",
        ],
        cwd,
      );
      const contractPath = join(
        cwd,
        "experiments/knowledge-brain/memoryLab/experiment.json",
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(contractPath)).toBe(true);
      expect(JSON.parse(readFileSync(contractPath, "utf8"))).toMatchObject({
        schemaVersion: 1,
        id: "memoryLab",
        system: "knowledge-brain",
        disposition: "extend",
        hypothesis: "A bounded memory view improves grounded answers.",
        productionRegistrations: false,
        promotionCommand: expect.stringContaining("template:add-feature"),
      });
      expect(JSON.parse(result.stdout).files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "experiments/knowledge-brain/memoryLab/src/index.ts",
          }),
        ]),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("builds a golden production feature as a complete vertical slice", () => {
    const result = buildFeatureFiles({
      name: "accountSignals",
      system: "knowledge-brain",
      disposition: "extend",
      screenCatalogId: starterContactsScreenId,
      description: "Present grounded account signals.",
    });
    const paths = result.files.map(({ path }) => path);
    const contract = result.files.find(({ path }) =>
      path.endsWith("/accountSignals/contract.ts"),
    )?.content;
    const model = result.files.find(({ path }) =>
      path.endsWith("/accountSignals/model.ts"),
    )?.content;
    const adapter = result.files.find(({ path }) =>
      path.endsWith("/accountSignals/adapter.ts"),
    )?.content;
    const generated = result.files.map(({ content }) => content).join("\n");
    const route = result.files.find(({ path }) =>
      path.endsWith("/_app/$workspace/_dashboard/account-signals.tsx"),
    )?.content;
    const provenance = result.files.find(
      ({ path }) =>
        path ===
        "docs/template/generated/provenance/add-feature/accountSignals.json",
    );

    expect(paths).toEqual(
      expect.arrayContaining([
        "packages/convex/confect/capabilities/accountSignals.spec.ts",
        "packages/convex/confect/capabilities/accountSignals.impl.ts",
        "apps/web/src/features/accountSignals/contract.ts",
        "apps/web/src/features/accountSignals/model.ts",
        "apps/web/src/features/accountSignals/adapter.ts",
        "apps/web/src/features/accountSignals/adapter.test.ts",
        "apps/web/src/routes/_app/$workspace/_dashboard/account-signals.tsx",
        "docs/template/generated/features/accountSignals.md",
      ]),
    );
    expect(contract).toContain('system: "knowledge-brain"');
    expect(contract).toContain(
      'export type AccountSignalsStatus = "planned" | "active" | "complete"',
    );
    expect(contract).toContain('tenantScope: "workspace"');
    expect(contract).toContain('auth: "workspace-member"');
    expect(contract).toContain("audit");
    expect(contract).toContain("observability");
    expect(contract).toContain("featureFlag");
    expect(contract).toContain("entitlement");
    expect(contract).toContain("dataLifecycle");
    expect(model).toContain('status: "loading"');
    expect(model).toContain('status: "empty"');
    expect(model).toContain('status: "list"');
    expect(model).toContain('status: "detail"');
    expect(model).toContain('status: "create"');
    expect(model).toContain('status: "edit"');
    expect(model).toContain('status: "typed-error"');
    expect(model).toContain('status: "transport-error"');
    expect(model).toContain('status: "success"');
    expect(adapter).toContain("presentAccountSignalsState");
    expect(adapter).not.toContain("createAccountSignalsAdapter");
    expect(generated).toContain(
      "Schema.Union([Unauthorized, ValidationFailed, Forbidden, NotFound])",
    );
    expect(generated).toContain(
      'Schema.Literals(["planned", "active", "complete"])',
    );
    expect(generated).toContain('FunctionSpec.publicMutation({ name: "remove"');
    expect(generated).toContain(
      'FunctionImpl.make(databaseSchema, group, "remove"',
    );
    expect(adapter).toContain(
      'import capability from "../../../../../packages/convex/confect/capabilities/accountSignals.spec"',
    );
    expect(adapter).toContain("export const accountSignalsRefs = Refs.make(");
    expect(adapter).toContain('from "@maestro-template/convex/refs"');
    expect(adapter).not.toContain('from "@confect/core"');
    expect(generated).not.toContain("Synthetic fixture");
    expect(generated).not.toContain('status: "accepted"');
    expect(generated).not.toContain("Replace fake fixtures");
    expect(route).toContain("ContactsListPage");
    expect(route).toContain("#features/contacts/list/list-page");
    expect(route).toContain("createFileRoute()(");
    expect(route).not.toContain(
      'createFileRoute("/_app/$workspace/_dashboard/account-signals")',
    );
    expect(route).not.toContain("_workspace");
    expect(generated).not.toContain("<Page.Root>");
    expect(generated).not.toContain('aria-label="AccountSignals title"');
    expect(JSON.parse(provenance?.content ?? "{}")).toMatchObject({
      generator: "add-feature",
      ownership: { system: "knowledge-brain", disposition: "extend" },
      frontend: {
        screenCatalogId: starterContactsScreenId,
        sourceReceipt: "docs/template/saas-ui-starter-files.json",
        shellId: "app-shell",
        requiredVisualStates: [
          "loading",
          "empty",
          "error",
          "populated",
          "selected",
          "mutation",
        ],
        destinationClosureSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        files: expect.arrayContaining([
          expect.objectContaining({
            source: "apps/web/src/features/contacts/list/list-page.tsx",
            destination: "apps/web/src/features/contacts/list/list-page.tsx",
            allowedPatches: expect.any(Array),
          }),
        ]),
      },
      generatedPaths: expect.arrayContaining([
        "packages/convex/confect/capabilities/accountSignals.spec.ts",
        "apps/web/src/routes/_app/$workspace/_dashboard/account-signals.tsx",
      ]),
    });
    const syntaxDiagnostics = result.files
      .filter(({ path }) => /\.[cm]?[jt]sx?$/.test(path))
      .flatMap(
        ({ path, content }) =>
          transpileModule(content, {
            fileName: path,
            reportDiagnostics: true,
            compilerOptions: {
              jsx: JsxEmit.ReactJSX,
              module: ModuleKind.ESNext,
              target: ScriptTarget.ES2022,
            },
          }).diagnostics ?? [],
      );
    expect(syntaxDiagnostics).toEqual([]);
  });

  it("writes a golden feature through the CLI", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-feature-"));

    try {
      const result = runGeneratorCli(
        [
          "add-feature",
          "--name",
          "accountSignals",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--screen-catalog-id",
          starterContactsScreenId,
          "--description",
          "Present grounded account signals.",
          "--write",
        ],
        cwd,
      );

      expect(result.exitCode).toBe(0);
      expect(
        existsSync(
          join(
            cwd,
            "apps/web/src/routes/_app/$workspace/_dashboard/account-signals.tsx",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(
            cwd,
            "packages/convex/confect/capabilities/accountSignals.spec.ts",
          ),
        ),
      ).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects missing and unknown screen selections without a JSX fallback", () => {
    const base = [
      "add-feature",
      "--name",
      "accountSignals",
      "--system",
      "knowledge-brain",
      "--disposition",
      "extend",
    ];
    const missing = runGeneratorCli(base);
    expect(missing).toMatchObject({ exitCode: 1 });
    expect(missing.stderr).toContain("Missing required --screen-catalog-id");

    const unknown = runGeneratorCli([
      ...base,
      "--screen-catalog-id",
      "starter-route:not-a-real-screen.tsx",
    ]);
    expect(unknown).toMatchObject({ exitCode: 1 });
    expect(unknown.stderr).toContain("Unknown or unsupported");

    const generated = buildFeatureFiles({
      name: "accountSignals",
      system: "knowledge-brain",
      disposition: "extend",
      screenCatalogId: starterContactsScreenId,
    })
      .files.map(({ content }) => content)
      .join("\n");
    expect(generated).not.toContain("<Page.Root>");
    expect(generated).not.toContain('aria-label="AccountSignals workspace"');
    expect(generated).toContain("ContactsListPage");
  });

  it("materializes a generated feature that lints and typechecks", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "maestro-feature-smoke-"));
    const cwd = join(tempRoot, "repo");
    const name = "generatedFeatureSmoke";

    try {
      copyRepoForSmoke(repoRoot, cwd);
      for (const path of [
        "node_modules",
        "apps/web/node_modules",
        "packages/convex/node_modules",
        "tooling/generators/node_modules",
      ])
        rmSync(join(cwd, path), { recursive: true, force: true });
      await runSmokeCommandAsync(cwd, {
        label: "Install isolated feature smoke dependencies",
        command: "pnpm",
        args: [
          "--dir",
          cwd,
          "install",
          "--frozen-lockfile",
          "--ignore-scripts",
        ],
      });
      await runSmokeCommandAsync(cwd, {
        label: "Generate feature business-entity table",
        command: "pnpm",
        args: [
          "--dir",
          cwd,
          "template:add-table",
          "--",
          "--name",
          name,
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
          "--write",
        ],
      });
      await runSmokeCommandAsync(cwd, {
        label: "Generate feature output",
        command: "pnpm",
        args: [
          "--dir",
          cwd,
          "template:add-feature",
          "--",
          "--name",
          name,
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--screen-catalog-id",
          starterContactsScreenId,
          "--description",
          "Generated feature smoke check.",
          "--write",
        ],
      });
      await runSmokeCommandAsync(cwd, {
        label: "Regenerate Confect refs for generated feature output",
        command: "pnpm",
        args: ["--dir", cwd, "confect:codegen"],
      });
      await runSmokeCommandAsync(cwd, {
        label: "Lint generated upstream route and adapter",
        command: "pnpm",
        args: [
          "--dir",
          cwd,
          "exec",
          "eslint",
          "apps/web/src/routes/_app/$workspace/_dashboard/generated-feature-smoke.tsx",
          `apps/web/src/features/${name}/adapter.ts`,
        ],
      });
      await runSmokeCommandAsync(cwd, {
        label: "Run raw TypeScript for generated upstream route",
        command: "pnpm",
        args: [
          "--dir",
          cwd,
          "exec",
          "tsc",
          "-p",
          "apps/web/tsconfig.json",
          "--noEmit",
          "--incremental",
          "false",
          "--pretty",
          "false",
        ],
      });
      await runSmokeCommandAsync(cwd, {
        label: "Regenerate and typecheck generated feature web output",
        command: "pnpm",
        args: ["--dir", join(cwd, "apps/web"), "typecheck"],
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 900_000);

  it("refuses to overwrite an existing golden feature path", () => {
    const cwd = mkdtempSync(join(tmpdir(), "maestro-template-feature-clash-"));
    const routePath = join(
      cwd,
      "apps/web/src/routes/_app/$workspace/_dashboard/account-signals.tsx",
    );

    try {
      mkdirSync(dirname(routePath), { recursive: true });
      writeFileSync(routePath, "// user-owned route\n");
      const result = runGeneratorCli(
        [
          "add-feature",
          "--name",
          "accountSignals",
          "--system",
          "knowledge-brain",
          "--disposition",
          "extend",
          "--screen-catalog-id",
          starterContactsScreenId,
          "--write",
        ],
        cwd,
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Refusing to overwrite existing paths");
      expect(readFileSync(routePath, "utf8")).toBe("// user-owned route\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("prints direct generator help before required argument parsing", () => {
    const result = runGeneratorCli(["add-workflow", "--help"]);

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining("template:add-workflow --name <name>"),
      stderr: "",
    });

    const preview = runGeneratorCli([
      "add-workflow",
      "--name",
      "directSafety",
      "--system",
      "knowledge-brain",
      "--disposition",
      "extend",
    ]);
    expect(JSON.parse(preview.stdout)).toMatchObject({
      privacy: { classification: "review-required", secrets: "names-only" },
      reviewedEquivalent: {
        argv: expect.arrayContaining([
          "node",
          "maestro-template.mjs",
          "scaffold",
        ]),
      },
    });
  });

  it("rejects surplus words after a systems query", () => {
    const ambiguous = runGeneratorCli(["systems", "--query", "social", "sync"]);
    const quoted = runGeneratorCli(["systems", "--query", "social sync"]);

    expect(ambiguous.exitCode).toBe(1);
    expect(ambiguous.stderr).toContain("Quote multi-word queries");
    expect(quoted.exitCode).toBe(0);
  });

  it("executes package-script argv and preserves an ambiguous-query failure", () => {
    let stdout = "";
    let stderr = "";
    const exitCode = runGeneratorCliProcess(
      ["systems", "--", "--query", "social", "sync"],
      {
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("Quote multi-word queries");
  });
});
