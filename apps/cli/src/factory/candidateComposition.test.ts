import { execFile, execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  buildSaasApplicationTargetPlan,
  createTemplateInstanceMigration,
  isWorkflowAutomationPath,
} from "@maestro-template/generators";
import { createReleaseTemplateInstanceConsumer } from "@maestro-template/release-tooling/customer-create";
import { templateInstanceSchemaProvider } from "@maestro-template/template-core/templateInstance";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_PUBLIC_SOURCE,
  createCustomerCreateComposition,
  loadCustomerCreateComposition,
} from "./createComposition";
import {
  buildCandidateReleaseFixture as buildSharedCandidateReleaseFixture,
  type SaasPlanBuilder,
} from "./customerCandidateFixture";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots: string[] = [];
const installedStoreDir = readFileSync(
  join(repositoryRoot, "node_modules/.modules.yaml"),
  "utf8",
).match(/^storeDir: (.+)$/m)?.[1];

const candidateEnvironment = (): NodeJS.ProcessEnv => ({
  ...process.env,
  TMPDIR: tmpdir(),
  npm_config_store_dir: installedStoreDir,
});

const executableOnPath = (
  command: string,
  environment: NodeJS.ProcessEnv,
): string | undefined =>
  (environment.PATH ?? "")
    .split(delimiter)
    .map((directory) => join(directory, command))
    .find((candidate) => existsSync(candidate));

const buildSelectedSaasPlan: SaasPlanBuilder = (options) =>
  buildSaasApplicationTargetPlan({
    ...options,
    patterns: ["records-example", "workflow-automation"],
  });

const buildCandidateReleaseFixture = (
  input: { readonly name: string; readonly outcome: string },
  buildPlan: SaasPlanBuilder = buildSelectedSaasPlan,
) => {
  const fixture = buildSharedCandidateReleaseFixture({
    repoRoot: repositoryRoot,
    ...input,
    buildPlan,
    authority: "alpha.3",
  });
  temporaryRoots.push(fixture.parent);
  return fixture;
};

const runCandidatePnpm = async (
  targetRoot: string,
  args: readonly string[],
): Promise<void> => {
  try {
    await execFileAsync("pnpm", args, {
      cwd: targetRoot,
      env: candidateEnvironment(),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 180_000,
    });
  } catch (error) {
    const failure = error as Error & {
      readonly stdout?: string;
      readonly stderr?: string;
    };
    throw new Error(
      [failure.message, failure.stdout, failure.stderr]
        .filter((value): value is string => Boolean(value))
        .join("\n"),
    );
  }
};

const listFiles = (root: string): readonly string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .sort();

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
}, 120_000);

describe("candidate customer composition", () => {
  it("seals candidate authority from the cloned source", () => {
    let planSourceRoot: string | undefined;
    const fixture = buildSharedCandidateReleaseFixture({
      repoRoot: repositoryRoot,
      name: "Source-bound Candidate",
      outcome: "Bind authority to the reviewed source",
      buildPlan: (options) => {
        planSourceRoot = options.sourceRoot;
        return buildSaasApplicationTargetPlan(options);
      },
      authority: "alpha.3",
    });
    temporaryRoots.push(fixture.parent);

    expect(planSourceRoot).toBe(fixture.candidateRoot);
  }, 30_000);

  it("uses existing platform-local paths for candidate subprocesses", () => {
    const environment = candidateEnvironment();

    expect(environment.PATH).toBe(process.env.PATH);
    expect(environment.TMPDIR).toBe(tmpdir());
    for (const path of [environment.TMPDIR, environment.npm_config_store_dir]) {
      expect(path).toBeTruthy();
      if (!path) throw new Error("Candidate environment path is missing.");
      expect(isAbsolute(path)).toBe(true);
      expect(existsSync(path)).toBe(true);
    }

    const pnpmExecutable = executableOnPath("pnpm", environment);
    expect(pnpmExecutable).toBeTruthy();
    if (!pnpmExecutable)
      throw new Error("Candidate environment cannot resolve pnpm.");
    expect(isAbsolute(pnpmExecutable)).toBe(true);
    expect(existsSync(pnpmExecutable)).toBe(true);
  });

  it("materializes a neutral chassis without optional product patterns", async () => {
    const name = "Neutral Candidate";
    const outcome = "Deliver the first customer outcome";
    const fixture = buildSharedCandidateReleaseFixture({
      repoRoot: repositoryRoot,
      name,
      outcome,
      buildPlan: buildSaasApplicationTargetPlan,
      authority: "alpha.1",
    });
    temporaryRoots.push(fixture.parent);
    const create = loadCustomerCreateComposition(
      fixture.source,
      buildSaasApplicationTargetPlan,
      createReleaseTemplateInstanceConsumer(
        templateInstanceSchemaProvider,
        createTemplateInstanceMigration(templateInstanceSchemaProvider),
      ),
    );
    const result = await create.run(
      [
        "create",
        fixture.targetRoot,
        "--name",
        name,
        "--outcome",
        outcome,
        "--demo-only",
        "--write",
        "--json",
      ],
      fixture.candidateRoot,
    );
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

    const files = listFiles(fixture.targetRoot);
    for (const path of [
      "apps/web/src/features/records/records-surface.tsx",
      "apps/web/src/screens/records-screen.tsx",
      "apps/web/src/routes/_workspace.records.tsx",
      "tooling/workflow/package.json",
    ])
      expect(files, path).not.toContain(path);
    expect(files.filter((path) => isWorkflowAutomationPath(path))).toEqual([]);
    expect(files).toContain("packages/convex/confect/deployAuthority/store.ts");

    await runCandidatePnpm(fixture.targetRoot, [
      "install",
      "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    execFileSync("git", ["init", "-q", "-b", "main"], {
      cwd: fixture.targetRoot,
    });
    execFileSync("git", ["add", "-A"], { cwd: fixture.targetRoot });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Maestro Acceptance",
        "-c",
        "user.email=acceptance@maestro.local",
        "commit",
        "--quiet",
        "--no-verify",
        "-m",
        "materialize neutral customer",
      ],
      { cwd: fixture.targetRoot, env: { ...process.env, LEFTHOOK: "0" } },
    );
    await runCandidatePnpm(fixture.targetRoot, ["check:product-contract"]);
    const acceptance = await execFileAsync("pnpm", ["acceptance:required"], {
      cwd: fixture.targetRoot,
      env: candidateEnvironment(),
    });
    expect(acceptance.stdout).toContain("0 required, 0 runtime");
    expect(acceptance.stderr).toBe("");
  }, 180_000);

  it("materializes and verifies an untouched Confect 10 and Effect 4 candidate", async () => {
    expect(installedStoreDir).toBeTruthy();
    expect(
      execFileSync("pnpm", ["--version"], {
        env: candidateEnvironment(),
        encoding: "utf8",
      }).trim(),
    ).toBe("10.12.1");
    const name = "Candidate Validation";
    const outcome = "Validate the exact candidate customer artifact";
    const fixture = buildCandidateReleaseFixture({ name, outcome });
    const create = loadCustomerCreateComposition(
      fixture.source,
      buildSelectedSaasPlan,
    );
    const result = await create.run(
      [
        "create",
        fixture.targetRoot,
        "--name",
        name,
        "--outcome",
        outcome,
        "--demo-only",
        "--write",
        "--json",
      ],
      fixture.candidateRoot,
    );
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

    const neutralFixture = buildCandidateReleaseFixture(
      { name, outcome },
      buildSaasApplicationTargetPlan,
    );
    const neutralCreate = loadCustomerCreateComposition(
      neutralFixture.source,
      buildSaasApplicationTargetPlan,
    );
    const neutralResult = await neutralCreate.run(
      [
        "create",
        neutralFixture.targetRoot,
        "--name",
        name,
        "--outcome",
        outcome,
        "--demo-only",
        "--write",
        "--json",
      ],
      neutralFixture.candidateRoot,
    );
    expect(
      neutralResult.exitCode,
      `${neutralResult.stdout}\n${neutralResult.stderr}`,
    ).toBe(0);
    await runCandidatePnpm(neutralFixture.targetRoot, [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    await runCandidatePnpm(neutralFixture.targetRoot, [
      "run",
      "typecheck:saas-ui:baseline",
    ]);
    await runCandidatePnpm(neutralFixture.targetRoot, [
      "--dir",
      "apps/web",
      "typecheck",
    ]);

    const instance = JSON.parse(
      readFileSync(join(fixture.targetRoot, "template-instance.json"), "utf8"),
    ) as {
      readonly release: {
        readonly version: string;
        readonly tag: string;
        readonly sourceCommit: string;
      };
    };
    expect(instance.release).toEqual({
      version: "0.2.0-alpha.3",
      tag: fixture.tag,
      sourceCommit: fixture.reviewedSourceCommit,
      sourceChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    expect(fixture.source.sourceCommit).toBe(fixture.reviewedSourceCommit);
    expect(fixture.taggedCommit).not.toBe(fixture.reviewedSourceCommit);
    const customerFiles = listFiles(fixture.targetRoot);
    for (const factoryProductPrefix of [
      "packages/app-idea-evaluator/",
      "packages/convex/confect/buildPacks/",
      "packages/convex/confect/commerce/",
      "packages/convex/confect/evaluator/",
      "packages/convex/convex/buildPacks/",
      "packages/convex/convex/commerce/",
      "apps/web/src/features/public-funnel/",
    ])
      expect(
        customerFiles.some((path) => path.startsWith(factoryProductPrefix)),
        factoryProductPrefix,
      ).toBe(false);
    for (const factoryProductPath of [
      "packages/convex/confect/capabilities/evaluateAppIdea.impl.ts",
      "packages/convex/confect/capabilities/manageEvaluationReport.impl.ts",
      "packages/convex/confect/workflowContracts/generateCompleteBuildPack.spec.ts",
      "packages/convex/confect/_generated/registeredFunctions/capabilities/evaluateAppIdea.ts",
      "packages/convex/confect/_generated/tables/buildPacks.ts",
      "packages/convex/confect/tables/buildPacks.ts",
      "packages/convex/convex/workflowRunners/generateCompleteBuildPack.ts",
      "packages/convex/test/evaluator-state.test.ts",
      "apps/web/src/providers/posthog.test.tsx",
      "apps/web/src/public-routes.test.tsx",
      "apps/web/src/routes/build-pack.$packId.tsx",
      "apps/web/src/routes/evaluate.tsx",
      "apps/web/src/routes/privacy.tsx",
      "apps/web/src/routes/support.tsx",
      "apps/web/src/routes/terms.tsx",
    ])
      expect(customerFiles, factoryProductPath).not.toContain(
        factoryProductPath,
      );
    expect(customerFiles).toContain("packages/integrations/src/dodo.ts");
    expect(
      readFileSync(
        join(
          fixture.targetRoot,
          "apps/web/src/routes/_app/$workspace/_dashboard/index.tsx",
        ),
        "utf8",
      ),
    ).not.toContain("public-funnel");
    expect(
      readFileSync(
        join(fixture.targetRoot, "apps/web/src/routeTree.gen.ts"),
        "utf8",
      ),
    ).not.toMatch(
      /EvaluateRouteImport|CheckoutReturnRouteImport|BuildPackPackIdRouteImport/u,
    );
    const customerPackage = JSON.parse(
      readFileSync(join(fixture.targetRoot, "package.json"), "utf8"),
    ) as {
      readonly packageManager: string;
      readonly scripts: Readonly<Record<string, string>>;
    };
    const convexPackage = JSON.parse(
      readFileSync(
        join(fixture.targetRoot, "packages/convex/package.json"),
        "utf8",
      ),
    ) as { readonly dependencies: Readonly<Record<string, string>> };
    expect(customerPackage.packageManager).toBe("pnpm@10.12.1");
    for (const manifestPath of [
      "apps/web/package.json",
      "packages/convex/package.json",
      "tooling/generators/package.json",
    ]) {
      const manifest = JSON.parse(
        readFileSync(join(fixture.targetRoot, manifestPath), "utf8"),
      ) as { readonly dependencies?: Readonly<Record<string, string>> };
      expect(manifest.dependencies).not.toHaveProperty(
        "@maestro-template/app-idea-evaluator",
      );
    }
    const integrationsManifest = JSON.parse(
      readFileSync(
        join(fixture.targetRoot, "packages/integrations/package.json"),
        "utf8",
      ),
    ) as { readonly dependencies: Readonly<Record<string, string>> };
    expect(integrationsManifest.dependencies.dodopayments).toBe("^2.44.0");
    const customerLockfile = readFileSync(
      join(fixture.targetRoot, "pnpm-lock.yaml"),
      "utf8",
    );
    expect(customerLockfile).not.toContain(
      '"@maestro-template/app-idea-evaluator":',
    );
    expect(customerLockfile).toContain(
      "dodopayments:\n        specifier: ^2.44.0\n        version: 2.44.0",
    );
    expect(customerPackage.scripts).toHaveProperty(
      "check:confect-effect-compat",
    );
    expect(customerPackage.scripts).not.toHaveProperty("check:confect-v9");
    expect(convexPackage.dependencies).toMatchObject({
      "@confect/core": "10.0.0-next.9",
      "@confect/server": "10.0.0-next.9",
      effect: "4.0.0-beta.102",
    });
    const files = listFiles(fixture.targetRoot);
    expect(
      files.some((path) => path === "repos" || path.startsWith("repos/")),
    ).toBe(false);
    expect(files).toContain(
      "tooling/effectified-api-proof/confect-effect-compat-proof.ts",
    );
    expect(files).not.toContain(
      "tooling/effectified-api-proof/confect-v9-proof.ts",
    );
    const systems = JSON.parse(
      readFileSync(
        join(fixture.targetRoot, "docs/template/system-catalog.json"),
        "utf8",
      ),
    ) as {
      readonly systems: readonly { readonly tables: readonly string[] }[];
    };
    const resources = JSON.parse(
      readFileSync(
        join(fixture.targetRoot, "docs/template/data-resources.json"),
        "utf8",
      ),
    ) as { readonly resources: readonly { readonly id: string }[] };
    for (const table of ["records", "deployAuthorityAuditEvents"]) {
      expect(systems.systems.some(({ tables }) => tables.includes(table))).toBe(
        true,
      );
      expect(resources.resources.some(({ id }) => id === table)).toBe(true);
    }

    await runCandidatePnpm(fixture.targetRoot, [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    rmSync(join(fixture.targetRoot, "node_modules"), {
      recursive: true,
      force: true,
    });
    await runCandidatePnpm(fixture.targetRoot, [
      "install",
      "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    const mcpInput = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          clientInfo: { name: "candidate-runtime", version: "1" },
          capabilities: {},
        },
      },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]
      .map((request) => JSON.stringify(request))
      .join("\n");
    const mcp = spawnSync("pnpm", ["--silent", "maestro", "--", "mcp"], {
      cwd: fixture.targetRoot,
      encoding: "utf8",
      env: candidateEnvironment(),
      input: `${mcpInput}\n`,
      timeout: 30_000,
    });
    expect(mcp.status, mcp.stderr).toBe(0);
    expect(
      mcp.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    ).toEqual([
      expect.objectContaining({
        id: 1,
        result: expect.objectContaining({
          serverInfo: expect.objectContaining({ name: "maestro-agent-pack" }),
        }),
      }),
      expect.objectContaining({
        id: 2,
        result: expect.objectContaining({ tools: expect.any(Array) }),
      }),
    ]);
    await runCandidatePnpm(fixture.targetRoot, ["check:confect-effect-compat"]);
    await runCandidatePnpm(fixture.targetRoot, ["check:confect-contracts"]);
    const generatedManifestPath = join(
      fixture.targetRoot,
      "packages/template-core/src/generated/confectManifest.ts",
    );
    // The immutable alpha.2 artifact carries its historical generated output,
    // while customer materialization marks this file as regenerable. Refresh
    // it against the materialized dependency/schema set before checking it.
    await runCandidatePnpm(fixture.targetRoot, ["confect:manifest"]);
    const generatedManifestBefore = readFileSync(generatedManifestPath, "utf8");
    const plannedManifest = buildSelectedSaasPlan({
      name,
      firstOutcome: outcome,
    }).entries.find(
      ({ path }) =>
        path === "packages/template-core/src/generated/confectManifest.ts",
    );
    if (!plannedManifest)
      throw new Error("Candidate manifest plan is missing.");
    expect(generatedManifestBefore).toBe(plannedManifest.content);
    try {
      await runCandidatePnpm(fixture.targetRoot, ["check:confect-manifest"]);
    } catch (error) {
      const before = generatedManifestBefore.split("\n");
      const generatedManifestAfter = readFileSync(
        generatedManifestPath,
        "utf8",
      );
      const after = generatedManifestAfter.split("\n");
      const difference = Math.max(
        0,
        before.findIndex((line, index) => line !== after[index]),
      );
      throw new Error(
        `${String(error)}\nGenerated manifest first differs at line ${difference + 1}:\nBEFORE ${before.slice(difference, difference + 8).join("\nBEFORE ")}\nAFTER ${after.slice(difference, difference + 8).join("\nAFTER ")}`,
      );
    }
    await runCandidatePnpm(fixture.targetRoot, [
      "--dir",
      "packages/convex",
      "typecheck",
    ]);
    await runCandidatePnpm(fixture.targetRoot, [
      "--dir",
      "packages/convex",
      "confect:codegen",
    ]);
  }, 900_000);

  it("keeps the zero-argument production composition on its sealed manifest", () => {
    const manifest = JSON.parse(
      readFileSync(CURRENT_PUBLIC_SOURCE.manifestPath, "utf8"),
    ) as {
      readonly release: {
        readonly sourceCommit: string;
        readonly tag: string;
        readonly version: string;
      };
    };
    expect(manifest.release.tag).toBe(
      `maestro-template-v${manifest.release.version}`,
    );
    expect(CURRENT_PUBLIC_SOURCE).toMatchObject({
      tag: manifest.release.tag,
      sourceCommit: manifest.release.sourceCommit,
      manifestPath: expect.stringContaining(
        `releases/v${manifest.release.version}/manifest.json`,
      ),
    });
    expect(loadCustomerCreateComposition().command).toBe("create");
  });

  it("composes a command without reading release authority files", () => {
    const missingAuthority = join(
      tmpdir(),
      "maestro-missing-blueprint-authority.json",
    );
    const source = {
      ...CURRENT_PUBLIC_SOURCE,
      blueprintManifestPath: missingAuthority,
      blueprintAuthorityManifestPath: missingAuthority,
    };

    expect(
      createCustomerCreateComposition(
        source,
        buildSaasApplicationTargetPlan,
        new Map(),
      ).command,
    ).toBe("create");
  });
});
