import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import { buildCustomerOwnershipInventory } from "@maestro-template/release-tooling/customer-ownership";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_PUBLIC_SOURCE,
  createCustomerCreateComposition,
  type CustomerCompositionSource,
} from "./createComposition";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots: string[] = [];
const installedStoreDir = readFileSync(
  join(repositoryRoot, "node_modules/.modules.yaml"),
  "utf8",
).match(/^storeDir: (.+)$/m)?.[1];

const hash = (bytes: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const targetEntryIdentity = (
  entry: ReturnType<typeof buildSaasApplicationTargetPlan>["entries"][number],
) => ({
  path: entry.path,
  ownership: entry.ownership,
  action: entry.action,
  upgrade: entry.upgrade,
  sha256: entry.sha256,
  ...(entry.replaces === undefined ? {} : { replaces: entry.replaces }),
});

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

const writeJson = (path: string, value: unknown): Buffer => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path, bytes);
  return bytes;
};

const git = (repository: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", repository, ...args], {
    maxBuffer: 512 * 1024 * 1024,
  });

const buildCandidateReleaseFixture = (input: {
  readonly name: string;
  readonly outcome: string;
}) => {
  const parent = mkdtempSync(join(tmpdir(), "maestro-candidate-composition-"));
  temporaryRoots.push(parent);
  const candidateRoot = join(parent, "candidate");
  const targetRoot = join(parent, "customer");
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      "--shared",
      "--no-tags",
      repositoryRoot,
      candidateRoot,
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const authorityRoot = join(candidateRoot, ".candidate-authority");
  appendFileSync(
    join(candidateRoot, ".git/info/exclude"),
    "\n.candidate-authority/\n",
  );
  mkdirSync(authorityRoot, { recursive: true });
  const sourceCommit = git(candidateRoot, ["rev-parse", "HEAD"])
    .toString("utf8")
    .trim();
  const tag = "maestro-template-v0.2.0-alpha.3";

  const sourcePaths = git(candidateRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    sourceCommit,
  ])
    .toString("utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  const plan = buildSaasApplicationTargetPlan({
    name: input.name,
    firstOutcome: input.outcome,
  });
  const blueprintOwnedPaths = new Set(
    plan.entries
      .filter((entry) => entry.replaces === undefined)
      .map((entry) => entry.path),
  );
  const paths = [
    ...buildCustomerOwnershipInventory(sourcePaths).map((entry) =>
      blueprintOwnedPaths.has(entry.path)
        ? {
            path: entry.path,
            match: "exact" as const,
            ownership: "factory-only" as const,
            action: "omit" as const,
            upgrade: "remove" as const,
          }
        : entry,
    ),
    {
      path: "template-instance.json",
      match: "exact" as const,
      ownership: "generated" as const,
      action: "generate" as const,
      upgrade: "regenerate" as const,
    },
  ];
  const expectedHashes = Object.fromEntries(
    paths
      .filter((entry) => entry.action === "copy" && entry.match === "exact")
      .map((entry) => [
        entry.path,
        hash(readFileSync(join(candidateRoot, entry.path))),
      ]),
  );
  const manifest = {
    $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
    schemaVersion: 1,
    materializationStatus: "materializable",
    release: {
      version: "0.2.0-alpha.3",
      tag,
      sourceCommit,
      sourceChecksum: hash(
        git(candidateRoot, ["archive", "--format=tar", sourceCommit]),
      ),
    },
    compatibility: { cli: "0.2.x", agentPack: "0.2.x" },
    paths,
    expectedHashes,
    extensionSeams: paths
      .filter((entry) => entry.ownership === "customer-extension")
      .map((entry) => ({
        path: entry.path,
        description: "Candidate customer extension seam.",
      })),
  };
  const manifestPath = join(authorityRoot, "manifest.json");
  const manifestBytes = writeJson(manifestPath, manifest);

  const blueprint = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    registrations: plan.registrations,
    parameterizedEntries: plan.parameterizedEntries,
    entries: plan.entries.map(targetEntryIdentity),
  };
  const blueprintManifestPath = join(authorityRoot, "blueprint.json");
  const blueprintManifestBytes = writeJson(blueprintManifestPath, blueprint);
  const blueprintAuthorityManifestPath = join(
    authorityRoot,
    "blueprint-authority.json",
  );
  const blueprintAuthorityManifestBytes = writeJson(
    blueprintAuthorityManifestPath,
    blueprint,
  );
  git(candidateRoot, ["add", "--force", ".candidate-authority"]);
  git(candidateRoot, [
    "-c",
    "user.name=Maestro Candidate Fixture",
    "-c",
    "user.email=maestro-candidate-fixture@example.invalid",
    "commit",
    "--quiet",
    "--no-verify",
    "-m",
    "test: seal candidate authority",
  ]);
  const taggedCommit = git(candidateRoot, ["rev-parse", "HEAD"])
    .toString("utf8")
    .trim();
  git(candidateRoot, ["tag", tag, taggedCommit]);
  const taggedManifest = git(candidateRoot, [
    "show",
    `${taggedCommit}:.candidate-authority/manifest.json`,
  ]);
  if (!taggedManifest.equals(manifestBytes))
    throw new Error("Candidate fixture tag does not contain manifest bytes.");
  const manifestRelative = relative(
    realpathSync(candidateRoot),
    realpathSync(manifestPath),
  )
    .split(sep)
    .join("/");
  const resolvedTagCommit = git(candidateRoot, ["rev-list", "-n", "1", tag])
    .toString("utf8")
    .trim();
  if (resolvedTagCommit !== taggedCommit)
    throw new Error("Candidate fixture tag resolves to the wrong commit.");
  if (
    !git(candidateRoot, [
      "show",
      `${resolvedTagCommit}:${manifestRelative}`,
    ]).equals(manifestBytes)
  )
    throw new Error("Candidate fixture manifest relative path is not tagged.");
  if (
    !git(realpathSync(candidateRoot), [
      "show",
      `${resolvedTagCommit}:${manifestRelative}`,
    ]).equals(manifestBytes)
  )
    throw new Error("Canonical candidate fixture path cannot read the tag.");
  const source: CustomerCompositionSource = {
    repositoryRoot: candidateRoot,
    manifestPath,
    ownershipManifestChecksum: hash(manifestBytes),
    tag,
    sourceCommit,
    blueprintManifestPath,
    blueprintManifestChecksum: hash(blueprintManifestBytes),
    blueprintAuthorityManifestPath,
    blueprintAuthorityManifestChecksum: hash(blueprintAuthorityManifestBytes),
  };
  return {
    candidateRoot,
    source,
    reviewedSourceCommit: sourceCommit,
    tag,
    taggedCommit,
    targetRoot,
  };
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
      timeout: 120_000,
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
}, 30_000);

describe("candidate customer composition", () => {
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
    const create = createCustomerCreateComposition(
      fixture.source,
      buildSaasApplicationTargetPlan,
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
        "--privacy-reviewed",
        "--json",
      ],
      fixture.candidateRoot,
    );
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

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
        join(fixture.targetRoot, "apps/web/src/routes/index.tsx"),
        "utf8",
      ),
    ).not.toContain("public-funnel");
    expect(
      readFileSync(
        join(fixture.targetRoot, "apps/web/src/providers/posthog.tsx"),
        "utf8",
      ),
    ).not.toMatch(/app-idea-evaluator|public-funnel/u);
    expect(
      readFileSync(
        join(fixture.targetRoot, "apps/web/src/routeTree.gen.ts"),
        "utf8",
      ),
    ).not.toMatch(
      /EvaluateRouteImport|CheckoutReturnRouteImport|BuildPackPackIdRouteImport/u,
    );
    const generatedRefsTest = readFileSync(
      join(
        fixture.targetRoot,
        "apps/web/src/adapters/confect-generated-refs.test.ts",
      ),
      "utf8",
    );
    expect(generatedRefsTest).toContain("BrainPageListRef");
    expect(generatedRefsTest).not.toContain("evaluateAppIdea");
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
    const plannedManifest = buildSaasApplicationTargetPlan({
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
      "apps/web",
      "typecheck",
    ]);
    await runCandidatePnpm(fixture.targetRoot, [
      "--dir",
      "packages/convex",
      "confect:codegen",
    ]);
  }, 180_000);

  it("keeps the zero-argument production composition on immutable alpha.3", () => {
    expect(CURRENT_PUBLIC_SOURCE).toMatchObject({
      tag: "maestro-template-v0.2.0-alpha.3",
      sourceCommit: "4da2c073d1a10db22f40aa56db2a95c88990c74a",
      manifestPath: expect.stringMatching(
        /releases\/v0\.2\.0-alpha\.3\/manifest\.json$/u,
      ),
    });
    expect(createCustomerCreateComposition().command).toBe("create");
  });
});
