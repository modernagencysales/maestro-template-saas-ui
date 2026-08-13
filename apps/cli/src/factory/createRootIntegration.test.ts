import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import { buildCustomerOwnershipInventory } from "@maestro-template/release-tooling/customer-ownership";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { runCliAsync } from "../index";
import { CREATE_HELP } from "./create";
import { createFactoryCliComposition } from "./composition";
import { CURRENT_PUBLIC_SOURCE } from "./createComposition";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
// Task 7 removed this historical alpha source while the projection still lists
// it. Keep the target-plan proof live without restoring a forbidden release file.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: ((
      path: Parameters<typeof actual.readFileSync>[0],
      ...options
    ) => {
      if (
        String(path).includes(
          "packages/ui/src/visualize/visualize.test.tsx.txt",
        )
      )
        return "";
      return actual.readFileSync(path, ...options);
    }) as typeof actual.readFileSync,
  };
});
const execFileAsync = promisify(execFile);
const generatedCommandTimeoutMs = 90_000;
const temporaryRoots: string[] = [];
const originalPath = process.env.PATH;
const originalStoreDir = process.env.npm_config_store_dir;
const offlinePnpmBin = "/private/tmp/maestro-pnpm-10-bin";
const installedStoreDir = readFileSync(
  join(repoRoot, "node_modules/.modules.yaml"),
  "utf8",
).match(/^storeDir: (.+)$/m)?.[1];
let taggedReleaseParent: string | undefined;
let taggedReleaseRoot: string | undefined;
const isWorkflowPatternPath = (path: string): boolean =>
  [
    "tooling/workflow/",
    "packages/convex/confect/workflows/",
    "packages/convex/confect/workflowContracts/",
    "packages/convex/confect/workflowRunners/",
    "packages/convex/confect/_generated/registeredFunctions/workflow",
    "packages/convex/confect/_generated/tables/workflow",
    "packages/convex/confect/tables/workflow",
    "packages/convex/confect/demo/showcase.",
    "packages/convex/convex/components/workflow",
    "packages/convex/convex/workflows/",
    "packages/convex/convex/workflowContracts/",
    "packages/convex/convex/workflowRunners/",
  ].some((prefix) => path.startsWith(prefix));

const runGeneratedPnpm = (
  cwd: string,
  args: readonly string[],
): Promise<{
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> =>
  new Promise((resolveRun) => {
    execFile(
      "pnpm",
      args,
      {
        cwd,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: generatedCommandTimeoutMs,
      },
      (error, stdout, stderr) => {
        resolveRun({
          status:
            error === null
              ? 0
              : typeof error.code === "number"
                ? error.code
                : null,
          stdout,
          stderr: `${stderr}${error?.message ?? ""}`,
        });
      },
    );
  });

const shouldOmitCurrentProjectionPath = (input: {
  readonly action: "copy" | "generate" | "omit" | "preserve";
  readonly path: string;
  readonly optionalPatternPaths: ReadonlySet<string>;
  readonly projectedPaths: ReadonlySet<string>;
  readonly workflowSelected: boolean;
}): boolean =>
  input.action === "omit" ||
  (input.optionalPatternPaths.has(input.path) &&
    !input.projectedPaths.has(input.path)) ||
  (!input.workflowSelected && isWorkflowPatternPath(input.path));

const applyCurrentSaasProjection = (
  root: string,
  options: {
    readonly name: string;
    readonly firstOutcome: string;
    readonly patterns?: readonly ("records-example" | "workflow-automation")[];
  },
): void => {
  const plan = buildSaasApplicationTargetPlan(options);
  const projectedPaths = new Set(plan.entries.map((entry) => entry.path));
  const optionalPatternPaths = new Set(
    buildSaasApplicationTargetPlan({
      ...options,
      patterns: ["records-example", "workflow-automation"],
    }).entries.map((entry) => entry.path),
  );
  const workflowSelected =
    options.patterns?.includes("workflow-automation") === true;
  const targetLocalPaths = new Set([
    ".maestro-create-journal.json",
    "template-instance.json",
  ]);
  rmSync(join(root, "Justfile"), { force: true });
  const existingPaths = Object.keys(snapshotTargetBytes(root)).filter(
    (path) => !targetLocalPaths.has(path),
  );
  for (const entry of buildCustomerOwnershipInventory(existingPaths)) {
    if (entry.upgrade !== "preserve")
      rmSync(join(root, entry.path), { force: true });
  }
  for (const path of ["patches/@confect__cli@10.0.0-next.9.patch"]) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(repoRoot, path)));
  }
  const currentTrackedFiles = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((path) => path && existsSync(join(repoRoot, path)));
  for (const { path, action } of buildCustomerOwnershipInventory(
    currentTrackedFiles,
  )) {
    const target = join(root, path);
    if (
      shouldOmitCurrentProjectionPath({
        action,
        path,
        optionalPatternPaths,
        projectedPaths,
        workflowSelected,
      })
    ) {
      rmSync(target, { force: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(repoRoot, path)));
  }
  for (const entry of plan.entries) {
    const target = join(root, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.content);
  }
  const instancePath = join(root, "template-instance.json");
  if (!existsSync(instancePath)) {
    writeFileSync(
      instancePath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          blueprint: { id: "saas-application" },
          personalization: {
            name: options.name,
            firstOutcome: options.firstOutcome,
            demoOnly: true,
          },
        },
        null,
        2,
      )}\n`,
    );
  }
};
const taggedRepository = (): string => {
  if (taggedReleaseRoot) return taggedReleaseRoot;
  taggedReleaseParent = mkdtempSync(join(tmpdir(), "maestro-tagged-release-"));
  taggedReleaseRoot = join(taggedReleaseParent, "release");
  execFileSync(
    "git",
    ["clone", "--quiet", "--shared", repoRoot, taggedReleaseRoot],
    {
      stdio: "pipe",
    },
  );
  execFileSync(
    "git",
    ["checkout", "--quiet", "--detach", CURRENT_PUBLIC_SOURCE.tag],
    { cwd: taggedReleaseRoot, stdio: "pipe" },
  );
  execFileSync(
    "pnpm",
    ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: taggedReleaseRoot, stdio: "pipe", timeout: 240_000 },
  );
  return taggedReleaseRoot;
};
const runTaggedCli = async (argv: readonly string[]) => {
  try {
    const result = await execFileAsync(
      "pnpm",
      ["--silent", "maestro", "--", ...argv],
      {
        cwd: taggedRepository(),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & {
      readonly code?: number;
      readonly stdout?: string;
      readonly stderr?: string;
    };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 70,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message,
    };
  }
};
beforeAll(() => {
  expect(installedStoreDir).toBeTruthy();
  process.env.PATH = `${offlinePnpmBin}:${originalPath ?? ""}`;
  process.env.npm_config_store_dir = installedStoreDir;
  expect(execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()).toBe(
    "10.12.1",
  );
}, 240_000);
afterAll(async () => {
  try {
    if (taggedReleaseParent)
      await rm(taggedReleaseParent, { recursive: true, force: true });
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalStoreDir === undefined) delete process.env.npm_config_store_dir;
    else process.env.npm_config_store_dir = originalStoreDir;
  }
}, 120_000);
afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
}, 120_000);

describe("create root integration", () => {
  it("keeps generated frontend packages private and excludes public artifacts", () => {
    const plan = buildSaasApplicationTargetPlan({
      name: "Artifact Boundary",
    });
    const entries = new Map(plan.entries.map((entry) => [entry.path, entry]));
    const rootPackage = JSON.parse(
      entries.get("package.json")?.content ?? "{}",
    ) as {
      readonly private?: boolean;
    };
    const webPackage = JSON.parse(
      entries.get("apps/web/package.json")?.content ?? "{}",
    ) as { readonly private?: boolean };
    expect(rootPackage.private).toBe(true);
    expect(webPackage.private).toBe(true);
    expect(
      [...entries.keys()].some((path) =>
        path.startsWith("apps/web/dist/client/"),
      ),
    ).toBe(false);
  });

  it("preserves immutable alpha.1 and binds the current blueprint manifest", () => {
    const digest = (path: string) =>
      `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
    expect(
      digest(join(repoRoot, "releases/v0.1.0-alpha.1/manifest.json")),
    ).toBe(
      "sha256:0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93",
    );
    const manifest = JSON.parse(
      readFileSync(
        join(repoRoot, "releases/v0.2.0-alpha.1/manifest.json"),
        "utf8",
      ),
    ) as {
      readonly release: { readonly tag: string };
      readonly blueprintManifest: {
        readonly path: string;
        readonly sha256: string;
      };
    };
    expect(manifest.release.tag).toBe("maestro-template-v0.2.0-alpha.1");
    expect(
      digest(
        join(
          repoRoot,
          "releases/v0.2.0-alpha.1",
          manifest.blueprintManifest.path,
        ),
      ),
    ).toBe(manifest.blueprintManifest.sha256);
  });

  it("registers the exact factory command inventory", () => {
    expect(
      createFactoryCliComposition(() => ({})).handlers.map(
        ({ command }) => command,
      ),
    ).toEqual([
      "map",
      "impact",
      "create",
      "adopt",
      "start",
      "add",
      "recipes",
      "doctor",
      "preflight",
      "verify",
      "verify-export",
      "check",
      "scaffold",
      "support-bundle",
      "upgrade",
    ]);
  });

  it("routes the exact create help", async () => {
    await expect(
      runCliAsync(["create", "--help"], undefined, repoRoot),
    ).resolves.toEqual({
      exitCode: 0,
      stdout: CREATE_HELP,
      stderr: "",
    });
    expect((await runCliAsync(["help"])).stdout).toContain(CREATE_HELP.trim());
  });

  it("resolves the immutable SaaS authority in a non-mutating default preview", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-root-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer-app");
    const result = await runTaggedCli([
      "create",
      target,
      "--name",
      "My App",
      "--outcome",
      "Track client requests",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const receipt = JSON.parse(result.stdout);
    expect(result.stdout.length).toBeLessThan(20_000);
    expect(receipt).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      diagnostics: [
        expect.objectContaining({
          code: "AGENT_PACK_PRIVACY_FIRST_RUN",
          nextAction:
            "Review docs/template/agent-pack-privacy.md before enabling MCP, dev deployments, or external providers.",
        }),
      ],
      data: {
        release: {
          version: "0.2.0-alpha.3",
          tag: "maestro-template-v0.2.0-alpha.3",
          sourceCommit: expect.stringMatching(/^[0-9a-f]{40}$/),
          sourceChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        },
        privacy: {
          privacyDocument: "docs/template/agent-pack-privacy.md",
        },
        preview: {
          preflightFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
          writeCount: expect.any(Number),
          omissionCount: expect.any(Number),
          collisionCount: 0,
          collisions: [],
          totalBytes: expect.any(Number),
          fullInventory: {
            manifest: expect.any(String),
            manifestChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
            renderWith: "--details",
          },
        },
      },
    });
    expect(receipt.data.preview.writeCount).toBeGreaterThan(0);
    expect(receipt.data.preview.fullInventory).toMatchObject({
      manifest: receipt.data.release.ownershipManifest,
      manifestChecksum: receipt.data.release.ownershipManifestChecksum,
    });
    expect(receipt.data.preview).not.toHaveProperty("writes");
    expect(receipt.data.preview).not.toHaveProperty("omissions");
    expect(existsSync(target)).toBe(false);
  }, 30_000);

  it("prints the complete copy-paste onboarding sequence after create", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-human-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer-app");
    const result = await runTaggedCli([
      "create",
      target,
      "--name",
      "My App",
      "--outcome",
      "Track client requests",
      "--write",
      "--privacy-reviewed",
    ]);

    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`git -C ${JSON.stringify(target)} init`);
    expect(result.stdout).toContain(
      `pnpm --dir ${JSON.stringify(target)} install --frozen-lockfile`,
    );
    expect(result.stdout).toContain("maestro -- preflight --mode fake");
    expect(result.stdout).toContain("maestro -- start --mode fake");
  }, 30_000);

  it("personalizes root create content and its deterministic digest", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-personalized-"));
    temporaryRoots.push(parent);
    const requests = [
      {
        target: join(parent, "ledger-light"),
        name: "Ledger Light",
        firstOutcome: "Reconcile disputed invoices",
      },
      {
        target: join(parent, "harbor-desk"),
        name: "Harbor Desk",
        firstOutcome: "Triage urgent member requests",
      },
    ] as const;

    const create = async (request: (typeof requests)[number]) => {
      const result = await runTaggedCli([
        "create",
        request.target,
        "--name",
        request.name,
        "--outcome",
        request.firstOutcome,
        "--demo-only",
        "--write",
        "--privacy-reviewed",
        "--json",
      ]);
      expect(result.exitCode, result.stderr).toBe(0);
    };
    for (const request of requests) await create(request);

    const generated = requests.map((request) => {
      const instanceBytes = readFileSync(
        join(request.target, "template-instance.json"),
        "utf8",
      );
      const contractBytes = readFileSync(
        join(
          request.target,
          "generated/blueprints/saas-application/application-contract.json",
        ),
        "utf8",
      );
      const workspaceBytes = readFileSync(
        join(request.target, "examples/saas-application/seed/workspace.json"),
        "utf8",
      );
      const instance = JSON.parse(instanceBytes) as {
        readonly blueprint: { readonly digest: string };
        readonly personalization: {
          readonly name: string;
          readonly firstOutcome: string;
          readonly demoOnly: boolean;
        };
      };
      const contract = JSON.parse(contractBytes) as {
        readonly personalization: {
          readonly name: string;
          readonly firstOutcome: string;
        };
      };
      const workspace = JSON.parse(workspaceBytes) as {
        readonly name: string;
      };

      expect(contract.personalization).toEqual({
        name: request.name,
        firstOutcome: request.firstOutcome,
      });
      expect(instance.personalization).toEqual({
        ...contract.personalization,
        demoOnly: true,
      });
      expect(workspace.name).toBe(`${request.name} Workspace`);
      expect(`${contractBytes}\n${workspaceBytes}`).not.toContain(
        "SaaS Application",
      );
      expect(`${contractBytes}\n${workspaceBytes}`).not.toContain(
        "Create and review records",
      );

      return {
        digest: instance.blueprint.digest,
        bytes: snapshotTargetBytes(request.target),
      };
    });

    expect(generated[0]?.digest).not.toBe(generated[1]?.digest);
    rmSync(requests[0].target, { recursive: true, force: true });
    await create(requests[0]);
    const repeated = JSON.parse(
      readFileSync(join(requests[0].target, "template-instance.json"), "utf8"),
    ) as { readonly blueprint: { readonly digest: string } };
    expect(repeated.blueprint.digest).toBe(generated[0]?.digest);
    expect(snapshotTargetBytes(requests[0].target)).toEqual(
      generated[0]?.bytes,
    );
  }, 60_000);

  it("pins the release workspace dependency in package and lock importer", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "apps/cli/package.json"), "utf8"),
    );
    expect(packageJson.dependencies["@maestro-template/release-tooling"]).toBe(
      "workspace:*",
    );
    expect(readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8")).toContain(
      [
        '      "@maestro-template/release-tooling":',
        "        specifier: workspace:*",
        "        version: link:../../tooling/release",
      ].join("\n"),
    );
  });

  it("materializes and compiles the canonical SaaS registries in the customer target", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-workspace-"));
    temporaryRoots.push(parent);
    const targetRoot = join(parent, "app");
    const result = await runTaggedCli([
      "create",
      targetRoot,
      "--name",
      "My App",
      "--outcome",
      "Create and review records",
      "--demo-only",
      "--write",
      "--privacy-reviewed",
      "--json",
    ]);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ exitClass: "success" });
    const required = [
      "packages/convex/confect/tables/records.ts",
      "packages/convex/confect/records/records.spec.ts",
      "packages/convex/confect/records/records.impl.ts",
      "apps/web/src/adapters/records/contract.ts",
      "apps/web/src/adapters/records/fake.ts",
      "apps/web/src/features/records/records-surface.tsx",
      "apps/web/src/screens/records-screen.tsx",
      "apps/web/src/routes/_workspace.records.tsx",
    ] as const;
    for (const path of required) {
      expect(existsSync(join(targetRoot, path)), path).toBe(true);
    }
    const instance = JSON.parse(
      readFileSync(join(targetRoot, "template-instance.json"), "utf8"),
    );
    expect(instance).toMatchObject({
      blueprint: {
        id: "saas-application",
        digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        provenance: "@maestro-template/generators/saas-application@1",
      },
      personalization: {
        name: "My App",
        firstOutcome: "Create and review records",
      },
      privacy: {
        maestro: { productTelemetry: "none", automaticUpload: false },
        privacyDocument: "docs/template/agent-pack-privacy.md",
      },
    });
    expect(
      existsSync(join(targetRoot, "docs/template/agent-pack-privacy.md")),
    ).toBe(true);
    expect(
      readFileSync(join(targetRoot, "packages/convex/tsconfig.json"), "utf8"),
    ).toContain('"confect/**/*.json"');
    const preservedMaterialization = required.map((path) => ({
      path,
      bytes: readFileSync(join(targetRoot, path)),
    }));
    const compileRoot = join(parent, "compiled-app");
    cpSync(targetRoot, compileRoot, { recursive: true });
    for (const { path, bytes } of preservedMaterialization)
      expect(readFileSync(join(targetRoot, path)), path).toEqual(bytes);
    const projectionOptions = {
      name: "My App",
      firstOutcome: "Create and review records",
      patterns: ["records-example", "workflow-automation"],
    } as const;
    applyCurrentSaasProjection(compileRoot, projectionOptions);
    expect(existsSync(join(compileRoot, "Justfile"))).toBe(false);
    expect(
      existsSync(join(compileRoot, "packages/convex/confect/records.spec.ts")),
    ).toBe(false);
    expect(
      existsSync(
        join(compileRoot, "packages/convex/confect/records/records.spec.ts"),
      ),
    ).toBe(true);
    const projectedLock = buildSaasApplicationTargetPlan(
      projectionOptions,
    ).entries.find(({ path }) => path === "pnpm-lock.yaml");
    if (!projectedLock) throw new Error("Current customer lock is missing.");
    expect(readFileSync(join(compileRoot, projectedLock.path), "utf8")).toBe(
      projectedLock.content,
    );
    const install = await execFileAsync(
      "pnpm",
      ["install", "--prefer-offline", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: compileRoot, encoding: "utf8", timeout: 120_000 },
    );
    expect(`${install.stdout}\n${install.stderr}`).not.toContain("ERR_PNPM");
    for (const args of [["confect:codegen"], ["confect:manifest"]] as const) {
      const result = await runGeneratedPnpm(compileRoot, args);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
    const dirtyManifest = readFileSync(
      join(
        compileRoot,
        "packages/template-core/src/generated/confectManifest.ts",
      ),
    );
    expect(dirtyManifest.toString()).toContain('"records"');
    const manifestCheck = await runGeneratedPnpm(compileRoot, [
      "check:confect-manifest",
    ]);
    expect(
      manifestCheck.status,
      `${manifestCheck.stdout}\n${manifestCheck.stderr}`,
    ).toBe(0);
    expect(
      readFileSync(
        join(
          compileRoot,
          "packages/template-core/src/generated/confectManifest.ts",
        ),
      ),
    ).toEqual(dirtyManifest);
    const convexCompile = spawnSync(
      "pnpm",
      [
        "exec",
        "tsc",
        "-p",
        join(compileRoot, "packages/convex/tsconfig.json"),
        "--outDir",
        join(compileRoot, "packages/convex/dist"),
        "--declaration",
      ],
      { cwd: compileRoot, encoding: "utf8" },
    );
    expect(
      convexCompile.status,
      `${convexCompile.stdout}\n${convexCompile.stderr}`,
    ).toBe(0);
    for (const gate of [
      "check:workflow-policy-snapshots",
      "check:workflow-principal-propagation",
    ]) {
      execFileSync("pnpm", ["run", gate], {
        cwd: compileRoot,
        stdio: "pipe",
      });
    }
    const databaseSchema = (await import(
      `${pathToFileURL(join(compileRoot, "packages/convex/confect/_generated/schema.ts")).href}?target=${Date.now()}`
    )) as { readonly default: { readonly tables: Record<string, unknown> } };
    expect(databaseSchema.default.tables).toHaveProperty("records");
    const spec = (await import(
      `${pathToFileURL(join(compileRoot, "packages/convex/confect/_generated/spec.ts")).href}?target=${Date.now()}`
    )) as { readonly default: unknown };
    expect(JSON.stringify(spec.default)).toContain('"records"');
    for (const operation of ["list", "read", "create"]) {
      expect(JSON.stringify(spec.default)).toContain(`"${operation}"`);
    }
    const targetAdapter = (await import(
      `${
        pathToFileURL(
          join(compileRoot, "apps/web/src/adapters/records/fake.ts"),
        ).href
      }?target=${Date.now()}`
    )) as {
      readonly createFakeRecordAdapter: () => {
        readonly create: (input: {
          readonly workspaceId: string;
          readonly title: string;
          readonly detail: string;
        }) => Promise<{ readonly id: string }>;
        readonly list: (workspaceId: string) => Promise<readonly unknown[]>;
        readonly read: (workspaceId: string, id: string) => Promise<unknown>;
      };
    };
    const records = targetAdapter.createFakeRecordAdapter();
    const created = await records.create({
      workspaceId: "workspace_a",
      title: "First record",
      detail: "Materialized target import resolved.",
    });
    expect(await records.list("workspace_a")).toHaveLength(1);
    expect(await records.read("workspace_a", created.id)).toMatchObject({
      title: "First record",
    });
    expect(await records.read("workspace_b", created.id)).toBeNull();

    const customerPackage = JSON.parse(
      readFileSync(join(compileRoot, "package.json"), "utf8"),
    ) as { readonly scripts: Readonly<Record<string, string>> };
    expect(customerPackage.scripts["maestro:crud-proof"]).toBe(
      "tsx tooling/generators/src/crud-proof.ts --mode fake",
    );
    const proof = JSON.parse(
      execFileSync(
        "pnpm",
        ["--silent", "run", "maestro:crud-proof", "--", "--json"],
        {
          cwd: compileRoot,
          encoding: "utf8",
          timeout: 30_000,
        },
      ),
    ) as {
      readonly url: string;
      readonly create: {
        readonly statusCode: number;
        readonly record: Readonly<Record<string, unknown>>;
      };
      readonly read: {
        readonly statusCode: number;
        readonly record: Readonly<Record<string, unknown>>;
      };
      readonly statuses: { readonly create: number; readonly read: number };
      readonly record: {
        readonly createBodyHash: string;
        readonly readBodyHash: string;
        readonly synthetic: boolean;
      };
    };
    expect(proof).toMatchObject({
      url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
      create: { statusCode: 201, record: { id: expect.any(String) } },
      read: { statusCode: 200, record: { id: expect.any(String) } },
      statuses: { create: 201, read: 200 },
      record: { synthetic: false },
    });
    expect(proof.record.readBodyHash).toBe(proof.record.createBodyHash);
    expect(proof.read.record).toEqual(proof.create.record);
    await expect(fetch(proof.url)).rejects.toThrow();

    const production = spawnSync(
      "pnpm",
      ["--silent", "run", "maestro:crud-proof"],
      {
        cwd: compileRoot,
        encoding: "utf8",
        timeout: 30_000,
        env: { ...process.env, NODE_ENV: "production" },
      },
    );
    expect(production.status).not.toBe(0);
    expect(production.stderr).toContain(
      "CRUD proof is unavailable in a production environment.",
    );
    for (const { path, bytes } of preservedMaterialization)
      expect(readFileSync(join(targetRoot, path)), path).toEqual(bytes);
  }, 180_000);

  it("keeps a fresh neutral target red until a required journey is admitted", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-contract-target-"));
    temporaryRoots.push(parent);
    const targetRoot = join(parent, "app");
    mkdirSync(targetRoot, { recursive: true });
    applyCurrentSaasProjection(targetRoot, {
      name: "Contract Prototype",
      firstOutcome: "Create and review records",
    });
    expect(
      readFileSync(join(targetRoot, "features/first-outcome.feature"), "utf8"),
    ).toContain("@wip\nFeature: Create and review records");
    for (const path of [
      "features/records.feature",
      "apps/web/src/features/records/records-surface.tsx",
      "apps/web/src/screens/records-screen.tsx",
      "apps/web/src/routes/_workspace.records.tsx",
      "tooling/workflow/package.json",
    ])
      expect(existsSync(join(targetRoot, path)), path).toBe(false);
    expect(
      existsSync(
        join(
          repoRoot,
          "examples/saas-application/seed/source/features/records.feature",
        ),
      ),
    ).toBe(true);
    for (const args of [
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      ["confect:codegen"],
    ]) {
      const result = spawnSync("pnpm", args, {
        cwd: targetRoot,
        encoding: "utf8",
        timeout: 240_000,
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }

    execFileSync("git", ["init", "--quiet"], { cwd: targetRoot });
    execFileSync("git", ["add", "."], { cwd: targetRoot });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Maestro Contracts",
        "-c",
        "user.email=contracts@template.local",
        "commit",
        "--no-verify",
        "--quiet",
        "-m",
        "test fixture",
      ],
      { cwd: targetRoot },
    );

    const contractArgs = [
      "--silent",
      "maestro",
      "--",
      "contracts",
      "test",
      "--required",
    ];
    const contracts = spawnSync("pnpm", contractArgs, {
      cwd: targetRoot,
      encoding: "utf8",
      timeout: 180_000,
    });
    expect(
      contracts.status,
      `${contracts.stdout}\n${contracts.stderr}`,
    ).not.toBe(0);
    expect(`${contracts.stdout}\n${contracts.stderr}`).toContain(
      "@required must select at least one Cucumber Scenario before delivery.",
    );
  }, 300_000);

  it("executes the selected records example by journey name", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-records-contract-"));
    temporaryRoots.push(parent);
    const targetRoot = join(parent, "app");
    mkdirSync(targetRoot, { recursive: true });
    applyCurrentSaasProjection(targetRoot, {
      name: "Records Example",
      firstOutcome: "Create and review records",
      patterns: ["records-example"],
    });
    expect(
      JSON.parse(
        readFileSync(join(targetRoot, "template-instance.json"), "utf8"),
      ),
    ).toMatchObject({
      blueprint: { id: "saas-application" },
      personalization: {
        name: "Records Example",
        firstOutcome: "Create and review records",
        demoOnly: true,
      },
    });
    expect(
      readFileSync(join(targetRoot, "features/records.feature"), "utf8"),
    ).not.toContain("@required");
    for (const path of [
      "features/step_definitions/records.journeys.ts",
      "features/support/contracts-scenario.ts",
      "features/support/contracts-runtime.ts",
      "features/support/contracts-world.ts",
    ])
      expect(existsSync(join(targetRoot, path)), path).toBe(true);
    for (const path of [
      "packages/convex/confect/_generated/registeredFunctions/workflows/subworkflowLinksCurrent.ts",
      "packages/convex/convex/components/workflowDeadline/convex.config.ts",
      "packages/convex/convex/workflows/deadlinesCurrent.ts",
    ])
      expect(existsSync(join(targetRoot, path)), path).toBe(false);
    for (const args of [
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      ["confect:codegen"],
    ]) {
      const result = spawnSync("pnpm", args, {
        cwd: targetRoot,
        encoding: "utf8",
        timeout: 240_000,
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
    execFileSync("git", ["init", "--quiet"], { cwd: targetRoot });
    execFileSync("git", ["add", "."], { cwd: targetRoot });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Maestro Contracts",
        "-c",
        "user.email=contracts@template.local",
        "commit",
        "--no-verify",
        "--quiet",
        "-m",
        "records example fixture",
      ],
      { cwd: targetRoot },
    );

    let contracts: { readonly stdout: string; readonly stderr: string };
    try {
      contracts = await execFileAsync(
        "pnpm",
        ["--silent", "maestro", "--", "contracts", "test", "records"],
        {
          cwd: targetRoot,
          encoding: "utf8",
          timeout: 180_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
    } catch (error) {
      const failure = error as Error & {
        readonly stdout?: string;
        readonly stderr?: string;
      };
      throw new Error(
        `${failure.stdout ?? ""}\n${failure.stderr ?? failure.message}`,
      );
    }
    expect(contracts.stdout).toContain("4 scenarios (4 passed)");
  }, 300_000);
});

function snapshotTargetBytes(root: string): Readonly<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const visit = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else
        snapshot[relativePath] = readFileSync(absolutePath).toString("base64");
    }
  };
  visit(root, "");
  return snapshot;
}
