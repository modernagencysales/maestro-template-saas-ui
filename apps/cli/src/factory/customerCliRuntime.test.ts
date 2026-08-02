import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import { buildCustomerOwnershipInventory } from "@maestro-template/release-tooling/customer-ownership";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];
const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const originalPath = process.env.PATH;
const originalStoreDir = process.env.npm_config_store_dir;
const originalTmpdir = process.env.TMPDIR;
const platformTmpdir = tmpdir();
const offlinePnpmBin = "/private/tmp/maestro-pnpm-10-bin";
const installedStoreDir = readFileSync(
  join(repositoryRoot, "node_modules/.modules.yaml"),
  "utf8",
).match(/^storeDir: (.+)$/m)?.[1];
let taggedReleaseParent: string | undefined;
let taggedReleaseRoot: string | undefined;
const frozenAlpha2RuntimeSeam = [
  "apps/cli/src/factory/createComposition.ts",
  "tooling/generators/src/index.ts",
  "tooling/generators/src/blueprints/alpha2SaasApplicationPlan.ts",
  "tooling/generators/src/blueprints/customer/alpha2-plan.json.gz.b64",
] as const;
const taggedRepository = (): string => {
  if (taggedReleaseRoot) return taggedReleaseRoot;
  taggedReleaseParent = mkdtempSync(join(tmpdir(), "maestro-tagged-release-"));
  taggedReleaseRoot = join(taggedReleaseParent, "release");
  execFileSync(
    "git",
    ["clone", "--quiet", "--shared", repositoryRoot, taggedReleaseRoot],
    { stdio: "pipe" },
  );
  for (const path of frozenAlpha2RuntimeSeam) {
    const target = join(taggedReleaseRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(repositoryRoot, path)));
  }
  execFileSync(
    "pnpm",
    ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: taggedReleaseRoot, stdio: "pipe", timeout: 120_000 },
  );
  return taggedReleaseRoot;
};
const runTaggedCli = (argv: readonly string[]) => {
  const result = spawnSync("pnpm", ["--silent", "maestro", "--", ...argv], {
    cwd: taggedRepository(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    exitCode: result.status ?? 70,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};
beforeAll(() => {
  expect(installedStoreDir).toBeTruthy();
  process.env.PATH = `${offlinePnpmBin}:${originalPath ?? ""}`;
  process.env.npm_config_store_dir = installedStoreDir;
  process.env.TMPDIR = platformTmpdir;
  expect(execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()).toBe(
    "10.12.1",
  );
});

const unresolvedWorkspaceDependencies = (root: string): readonly string[] => {
  const manifests = ["apps", "packages", "tooling"].flatMap((directory) =>
    readdirSync(join(root, directory), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, directory, entry.name, "package.json"))
      .filter(existsSync),
  );
  const packages = manifests.map((path) => ({
    path,
    value: JSON.parse(readFileSync(path, "utf8")) as {
      readonly name?: string;
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
      readonly optionalDependencies?: Readonly<Record<string, string>>;
      readonly peerDependencies?: Readonly<Record<string, string>>;
    },
  }));
  const workspaceNames = new Set(
    packages.flatMap(({ value }) => (value.name ? [value.name] : [])),
  );

  return packages.flatMap(({ path, value }) =>
    [
      ...Object.entries(value.dependencies ?? {}),
      ...Object.entries(value.devDependencies ?? {}),
      ...Object.entries(value.optionalDependencies ?? {}),
      ...Object.entries(value.peerDependencies ?? {}),
    ]
      .filter(([, version]) => version.startsWith("workspace:"))
      .filter(([name]) => !workspaceNames.has(name))
      .map(([name]) => `${path.slice(root.length + 1)} -> ${name}`),
  );
};
const applyCurrentSaasProjection = (root: string): void => {
  for (const path of ["patches/@confect__cli@10.0.0-next.9.patch"]) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(repositoryRoot, path)));
  }
  const currentTrackedFiles = execFileSync("git", ["ls-files"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const { path, action } of buildCustomerOwnershipInventory(
    currentTrackedFiles,
  )) {
    const target = join(root, path);
    if (action === "omit") {
      rmSync(target, { force: true });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(repositoryRoot, path)));
  }
  for (const entry of buildSaasApplicationTargetPlan().entries) {
    const target = join(root, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.content);
  }
};
afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
}, 120_000);
afterAll(async () => {
  try {
    if (taggedReleaseParent)
      await rm(taggedReleaseParent, { recursive: true, force: true });
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalStoreDir === undefined) delete process.env.npm_config_store_dir;
    else process.env.npm_config_store_dir = originalStoreDir;
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
  }
}, 180_000);

describe("materialized customer CLI runtime closure", () => {
  it("uses existing platform-local temp storage for pnpm", () => {
    const configuredTmpdir = process.env.TMPDIR;
    if (!configuredTmpdir)
      throw new Error("Customer runtime TMPDIR is missing.");
    expect(configuredTmpdir).toBe(platformTmpdir);
    expect(existsSync(configuredTmpdir)).toBe(true);
  });

  it("installs the frozen release seam on the current workspace closure", () => {
    const releaseRoot = taggedRepository();
    expect(readFileSync(join(releaseRoot, "pnpm-lock.yaml"))).toEqual(
      readFileSync(join(repositoryRoot, "pnpm-lock.yaml")),
    );
    expect(
      existsSync(
        join(
          releaseRoot,
          "apps/cli/node_modules/@maestro-template/workflow-tooling/package.json",
        ),
      ),
    ).toBe(true);
  }, 120_000);

  it("runs privacy-aligned support preview and export from the current projection", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-current-customer-cli-"));
    temporaryRoots.push(parent);
    const releaseRoot = taggedRepository();
    const target = join(parent, "customer");
    const created = runTaggedCli([
      "create",
      target,
      "--name",
      "Current Privacy Closure",
      "--outcome",
      "Inspect local support facts",
      "--demo-only",
      "--write",
      "--privacy-reviewed",
      "--json",
    ]);
    expect(created.exitCode, `${created.stdout}\n${created.stderr}`).toBe(0);
    applyCurrentSaasProjection(target);

    const instancePath = join(target, "template-instance.json");
    const instance = JSON.parse(readFileSync(instancePath, "utf8")) as {
      readonly release: {
        readonly version: string;
        readonly tag: string;
        readonly sourceCommit: string;
        readonly sourceChecksum: string;
      };
      readonly ownership: {
        readonly manifest: string;
        readonly manifestChecksum: string;
      };
      readonly blueprint: { readonly digest: string };
      readonly privacy: { readonly privacyDocument: string | null };
    };
    expect(instance).toMatchObject({
      release: {
        version: "0.2.0-alpha.2",
        tag: "maestro-template-v0.2.0-alpha.2",
        sourceCommit: expect.stringMatching(/^[0-9a-f]{40}$/),
        sourceChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
      ownership: {
        manifest: "releases/v0.2.0-alpha.2/manifest.json",
        manifestChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
      privacy: {
        privacyDocument: "docs/template/agent-pack-privacy.md",
      },
    });
    expect(instance.ownership.manifestChecksum).toBe(
      `sha256:${createHash("sha256")
        .update(readFileSync(join(releaseRoot, instance.ownership.manifest)))
        .digest("hex")}`,
    );
    expect(instance.ownership.manifestChecksum).not.toBe(
      instance.release.sourceChecksum,
    );
    const privacyDocument = "docs/template/agent-pack-privacy.md";
    expect(existsSync(join(target, privacyDocument))).toBe(true);
    expect(readFileSync(join(target, privacyDocument), "utf8")).toBe(
      readFileSync(join(releaseRoot, privacyDocument), "utf8"),
    );
    expect(
      readFileSync(
        join(target, "apps/cli/src/factory/customerComposition.ts"),
        "utf8",
      ),
    ).toContain("createSupportBundleCliHandler");
    for (const path of [
      "tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts",
      "tooling/agent-pack/src/privacy/runtimeNetworkInterceptor.mjs",
    ])
      expect(existsSync(join(target, path))).toBe(false);

    await execFileAsync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: target, timeout: 120_000 },
    );
    const preview = spawnSync(
      "pnpm",
      ["--silent", "maestro", "--", "support-bundle", "--json"],
      { cwd: target, encoding: "utf8", timeout: 30_000 },
    );
    expect(preview.status, preview.stderr).toBe(0);
    const previewResult = JSON.parse(preview.stdout) as {
      readonly data: {
        readonly previewFingerprint: string;
        readonly bundle: { readonly versions: { readonly agentPack: string } };
      };
    };
    expect(previewResult.data.bundle.versions.agentPack).toBe("unavailable");
    expect(existsSync(join(target, ".maestro/support"))).toBe(false);

    const exported = spawnSync(
      "pnpm",
      [
        "--silent",
        "maestro",
        "--",
        "support-bundle",
        "--write",
        "--preview-fingerprint",
        previewResult.data.previewFingerprint,
        "--json",
      ],
      { cwd: target, encoding: "utf8", timeout: 30_000 },
    );
    expect(exported.status, exported.stderr).toBe(0);
    expect(
      JSON.parse(
        readFileSync(
          join(target, ".maestro/support/support-bundle.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({
      handling: { automaticUpload: false, containsSecrets: false },
      versions: { agentPack: "unavailable" },
    });
  }, 180_000);

  it("materializes complete SaaS ownership and lifecycle catalogs", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-customer-catalogs-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer");
    const created = runTaggedCli([
      "create",
      target,
      "--name",
      "Catalog Closure",
      "--outcome",
      "Track one governed record",
      "--demo-only",
      "--write",
      "--privacy-reviewed",
      "--json",
    ]);
    expect(created.exitCode, `${created.stdout}\n${created.stderr}`).toBe(0);

    const preservedCatalogs = [
      "docs/template/system-catalog.json",
      "docs/template/data-resources.json",
    ].map((path) => ({ path, bytes: readFileSync(join(target, path)) }));
    applyCurrentSaasProjection(target);
    for (const { path, bytes } of preservedCatalogs)
      writeFileSync(join(target, path), bytes);
    const projectedLock = buildSaasApplicationTargetPlan().entries.find(
      ({ path }) => path === "pnpm-lock.yaml",
    );
    if (!projectedLock) throw new Error("Current customer lock is missing.");
    expect(readFileSync(join(target, projectedLock.path), "utf8")).toBe(
      projectedLock.content,
    );
    expect(unresolvedWorkspaceDependencies(target)).toEqual([]);

    await execFileAsync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: target, timeout: 120_000 },
    );
    const systemGate = await execFileAsync(
      "pnpm",
      ["run", "check:system-catalog"],
      { cwd: target, timeout: 30_000 },
    );
    const lifecycleGate = await execFileAsync(
      "pnpm",
      ["run", "check:data-resources"],
      { cwd: target, timeout: 30_000 },
    );
    expect(systemGate.stdout).toContain("ok system catalog");
    expect(lifecycleGate.stdout).toContain("ok data resources");

    const systems = JSON.parse(
      readFileSync(join(target, "docs/template/system-catalog.json"), "utf8"),
    ) as {
      readonly systems: readonly {
        readonly id: string;
        readonly tables: readonly string[];
      }[];
    };
    const resources = JSON.parse(
      readFileSync(join(target, "docs/template/data-resources.json"), "utf8"),
    ) as { readonly resources: readonly { readonly id: string }[] };
    for (const table of ["records"]) {
      expect(systems.systems.some(({ tables }) => tables.includes(table))).toBe(
        true,
      );
      expect(resources.resources.some(({ id }) => id === table)).toBe(true);
    }
  }, 180_000);

  it("imports a reviewed private package from a committed customer", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-customer-private-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer");
    const created = runTaggedCli([
      "create",
      target,
      "--name",
      "Private Package Closure",
      "--outcome",
      "Review a generic private package",
      "--demo-only",
      "--write",
      "--privacy-reviewed",
      "--json",
    ]);
    expect(created.exitCode, `${created.stdout}\n${created.stderr}`).toBe(0);
    applyCurrentSaasProjection(target);

    const install = spawnSync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: target, encoding: "utf8", timeout: 120_000 },
    );
    expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);
    expect(
      existsSync(join(target, "examples/generic-ai-ops/template-package.json")),
    ).toBe(true);
    expect(existsSync(join(target, "examples/generic-ai-ops/seed"))).toBe(true);
    expect(
      existsSync(join(target, "tooling/generators/src/private-package.ts")),
    ).toBe(true);

    execFileSync("git", ["init", "--quiet"], { cwd: target });
    execFileSync("git", ["config", "user.email", "fixture@localhost"], {
      cwd: target,
    });
    execFileSync("git", ["config", "user.name", "Fixture"], { cwd: target });
    execFileSync("git", ["add", "."], { cwd: target });
    execFileSync(
      "git",
      ["commit", "--quiet", "--no-verify", "-m", "baseline"],
      { cwd: target },
    );

    const command = (name: string, rest: readonly string[]) =>
      spawnSync("pnpm", ["--silent", "run", name, "--", ...rest], {
        cwd: target,
        encoding: "utf8",
        timeout: 60_000,
      });
    const args = [
      "--fixture",
      "examples/generic-ai-ops",
      "--system",
      "knowledge-brain",
      "--disposition",
      "extend",
    ] as const;
    for (const script of [
      "template:private-package:dry-run",
      "template:private-package:import",
    ]) {
      const result = command(script, ["--help"]);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        `template:${script.slice("template:".length)}`,
      );
    }

    const dryRun = command("template:private-package:dry-run", args);
    expect(dryRun.status, dryRun.stderr).toBe(0);
    const preview = JSON.parse(dryRun.stdout) as {
      readonly files: readonly {
        readonly path: string;
        readonly content: string;
      }[];
      readonly collisions: readonly string[];
      readonly privacy: {
        readonly reads: readonly string[];
        readonly readsSeedData: boolean;
        readonly readsSecrets: boolean;
        readonly productionRegistrations: boolean;
      };
      readonly previewFingerprint: string;
      readonly confirmationCommand: string;
    };
    expect(preview).toMatchObject({
      collisions: [],
      privacy: {
        reads: ["template-package.json"],
        readsSeedData: false,
        readsSecrets: false,
        productionRegistrations: false,
      },
      previewFingerprint: expect.stringMatching(
        /^private_package_sha256:[0-9a-f]{64}$/,
      ),
    });
    expect(preview.confirmationCommand).toContain(preview.previewFingerprint);
    expect(JSON.stringify(preview)).not.toContain("workspace_demo");
    for (const file of preview.files)
      expect(existsSync(join(target, file.path))).toBe(false);
    expect(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: target,
        encoding: "utf8",
      }),
    ).toBe("");

    const unconfirmed = command("template:private-package:import", [
      ...args,
      "--write",
    ]);
    expect(unconfirmed.status).not.toBe(0);
    expect(unconfirmed.stderr).toContain("fingerprint mismatch");
    for (const file of preview.files)
      expect(existsSync(join(target, file.path))).toBe(false);

    const imported = command("template:private-package:import", [
      ...args,
      "--write",
      "--preflight-fingerprint",
      preview.previewFingerprint,
    ]);
    expect(imported.status, imported.stderr).toBe(0);
    for (const file of preview.files)
      expect(readFileSync(join(target, file.path), "utf8")).toBe(file.content);
    execFileSync("git", ["add", "."], { cwd: target });
    execFileSync(
      "git",
      ["commit", "--quiet", "--no-verify", "-m", "import private package"],
      { cwd: target },
    );

    const collisionPreview = command("template:private-package:dry-run", args);
    expect(collisionPreview.status, collisionPreview.stderr).toBe(0);
    const collisionPlan = JSON.parse(collisionPreview.stdout) as {
      readonly collisions: readonly string[];
      readonly previewFingerprint: string;
    };
    expect(collisionPlan.collisions).toEqual(
      preview.files.map(({ path }) => path),
    );
    const firstFile = preview.files[0];
    if (!firstFile) throw new Error("private-package preview emitted no files");
    const preservedPath = join(target, firstFile.path);
    const preservedBytes = readFileSync(preservedPath, "utf8");
    const collisionImport = command("template:private-package:import", [
      ...args,
      "--write",
      "--preflight-fingerprint",
      collisionPlan.previewFingerprint,
    ]);
    expect(collisionImport.status).not.toBe(0);
    expect(collisionImport.stderr).toContain("Refusing to overwrite");
    expect(readFileSync(preservedPath, "utf8")).toBe(preservedBytes);

    for (const gate of [
      "check:generators",
      "check:promotion-boundary",
      "check:secret-canaries",
    ]) {
      const result = spawnSync("pnpm", ["run", gate], {
        cwd: target,
        encoding: "utf8",
        timeout: 120_000,
      });
      const diagnostic =
        gate === "check:secret-canaries" && result.status !== 0
          ? spawnSync(
              "gitleaks",
              [
                "detect",
                "--config",
                ".gitleaks.toml",
                "--no-git",
                "--redact",
                "--source",
                ".",
                "--verbose",
              ],
              { cwd: target, encoding: "utf8", timeout: 120_000 },
            )
          : undefined;
      expect(
        result.status,
        `${gate}\n${result.stdout}\n${result.stderr}\n${diagnostic?.stdout ?? ""}\n${diagnostic?.stderr ?? ""}`,
      ).toBe(0);
    }
    expect(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: target,
        encoding: "utf8",
      }),
    ).toBe("");
  }, 240_000);

  it("installs and imports while immutable-tag preflight fails closed", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-customer-cli-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer");
    const created = runTaggedCli([
      "create",
      target,
      "--name",
      "Runtime Closure",
      "--outcome",
      "Track one customer request",
      "--demo-only",
      "--write",
      "--privacy-reviewed",
      "--json",
    ]);
    expect(created.exitCode, `${created.stdout}\n${created.stderr}`).toBe(0);
    applyCurrentSaasProjection(target);

    const customerEntry = readFileSync(
      join(target, "apps/cli/src/index.ts"),
      "utf8",
    );
    const customerComposition = readFileSync(
      join(target, "apps/cli/src/factory/customerComposition.ts"),
      "utf8",
    );
    expect(customerEntry).toContain("createCustomerCliComposition");
    expect(customerComposition).not.toMatch(
      /@maestro-template\/(stack-tooling|release-tooling)/,
    );

    await execFileAsync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: target,
      timeout: 120_000,
    });
    const mcpInput = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          clientInfo: { name: "customer-runtime", version: "1" },
          capabilities: {},
        },
      },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "maestro_support_bundle_preview", arguments: {} },
      },
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "missing_customer_tool", arguments: {} },
      },
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: 42 },
      },
    ]
      .map((request) => JSON.stringify(request))
      .join("\n");
    const mcp = spawnSync("pnpm", ["--silent", "maestro", "--", "mcp"], {
      cwd: target,
      encoding: "utf8",
      input: `${mcpInput}\n`,
      timeout: 30_000,
    });
    expect(mcp.status, mcp.stderr).toBe(0);
    const mcpResponses = mcp.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(mcpResponses).toHaveLength(5);
    expect(mcpResponses[0]).toMatchObject({
      id: 1,
      result: { serverInfo: { name: "maestro-agent-pack" } },
    });
    expect(mcpResponses[1]).toMatchObject({
      id: 2,
      result: {
        tools: [
          { name: "maestro_preflight" },
          { name: "maestro_support_bundle_preview" },
          { name: "maestro_verify" },
        ],
      },
    });
    expect(mcpResponses[2]).toMatchObject({
      id: 3,
      result: { isError: false },
    });
    expect(mcpResponses[3]).toMatchObject({
      id: 4,
      result: { isError: true, code: "MCP_UNKNOWN_TOOL" },
    });
    expect(mcpResponses[4]).toMatchObject({
      id: 5,
      error: { code: -32602 },
    });
    expect(unresolvedWorkspaceDependencies(target)).toEqual([]);
    expect(existsSync(join(target, ".git"))).toBe(false);
    execFileSync("git", ["init", "--quiet"], { cwd: target });
    const prepare = spawnSync("pnpm", ["run", "prepare"], {
      cwd: target,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(prepare.status, `${prepare.stdout}\n${prepare.stderr}`).toBe(0);
    const hooksPath = execFileSync(
      "git",
      ["rev-parse", "--git-path", "hooks"],
      {
        cwd: target,
        encoding: "utf8",
      },
    ).trim();
    const resolvedHooksPath = resolve(target, hooksPath);
    const prepareOutput = `${prepare.stdout}\n${prepare.stderr}\nhooks=${resolvedHooksPath}`;
    expect(
      existsSync(join(resolvedHooksPath, "pre-commit")),
      prepareOutput,
    ).toBe(true);
    expect(existsSync(join(resolvedHooksPath, "pre-push")), prepareOutput).toBe(
      true,
    );
    execFileSync("git", ["config", "user.email", "fixture@localhost"], {
      cwd: target,
    });
    execFileSync("git", ["config", "user.name", "Fixture"], { cwd: target });
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      ".agents/skills/maestro/SKILL.md",
      ".agents/skills/maestro-convex/SKILL.md",
      ".claude/settings.json",
      "skills-lock.json",
      "packages/convex/convex/_generated/ai/ai-files.state.json",
      "packages/convex/convex/_generated/ai/guidelines.md",
      "tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json",
    ])
      expect(existsSync(join(target, path))).toBe(true);
    for (const skill of [
      "convex",
      "convex-create-component",
      "convex-migration-helper",
      "convex-performance-audit",
      "convex-quickstart",
      "convex-setup-auth",
    ]) {
      expect(existsSync(join(target, `.agents/skills/${skill}/SKILL.md`))).toBe(
        true,
      );
      expect(existsSync(join(target, `.claude/skills/${skill}/SKILL.md`))).toBe(
        true,
      );
    }
    for (const path of ["agent-pack", "tooling/stack", "tooling/release/src"])
      expect(existsSync(join(target, path))).toBe(false);
    expect(existsSync(join(target, "tooling/release/package.json"))).toBe(
      false,
    );
    const customerPackage = JSON.parse(
      readFileSync(join(target, "package.json"), "utf8"),
    ) as { readonly scripts: Readonly<Record<string, string>> };
    expect(customerPackage.scripts.test).toBe(
      "turbo run test --filter='./packages/*' --filter=@maestro-template/web",
    );
    expect(customerPackage.scripts["test:tooling"]).toBe(
      "pnpm test:bootstrap && pnpm --dir tooling/workflow test && pnpm --dir tooling/generators exec vitest run src/customer-runtime.test.ts src/templateInstanceMigration.test.ts src/workflow-publication-generation.test.ts src/workflow-release-commands.test.ts --maxWorkers=1 --no-file-parallelism",
    );
    expect(customerPackage.scripts.verify).toBe(
      [
        "check:format",
        "lint",
        "typecheck",
        "check:effect-diagnostics",
        "test",
        "test:tooling",
        "build",
        "check:convex-ai-files",
        "check:agent-pack",
        "check:route-tree",
        "check:frontend-effect-boundary",
        "check:env-boundary",
        "check:provider-boundary",
        "check:logging-boundary",
        "check:access-audit-events",
        "check:generators",
        "check:confect-effect-compat",
        "check:confect-contracts",
        "check:effectified-api-proof",
        "check:workflow-semantics",
        "check:workflow-graph-boundary",
        "check:workflow-policy-snapshots",
        "check:workflow-principal-propagation",
        "check:schema-migration-notes",
        "check:system-catalog",
        "check:system-topology",
        "check:data-resources",
        "check:append-only-tables",
        "check:promotion-boundary",
        "check:layer-boundaries",
        "check:confect-manifest",
        "check:headless-surface-contract",
        "check:posthog-readiness",
        "check:auth-demo-bypass",
      ]
        .map((name) => `pnpm ${name}`)
        .join(" && "),
    );
    const settingsPath = join(target, ".claude/settings.json");
    const settingsHash = () =>
      createHash("sha256").update(readFileSync(settingsPath)).digest("hex");
    expect(settingsHash()).toBe(
      "7825364f57b5c5f07c64d5c5bbbaa8046a6c1c21d3216112cc86f99d2e5b6ccc",
    );
    execFileSync("pnpm", ["format"], {
      cwd: target,
      stdio: "pipe",
      timeout: 120_000,
    });
    expect(settingsHash()).toBe(
      "7825364f57b5c5f07c64d5c5bbbaa8046a6c1c21d3216112cc86f99d2e5b6ccc",
    );
    execFileSync("git", ["add", "."], { cwd: target });
    execFileSync("git", ["commit", "--quiet", "--no-verify", "-m", "fixture"], {
      cwd: target,
    });
    const hostBin = join(parent, "supported-host-bin");
    mkdirSync(hostBin);
    const corepack = join(hostBin, "corepack");
    writeFileSync(corepack, "#!/bin/sh\nexit 0\n");
    chmodSync(corepack, 0o755);
    const supportedHostEnvironment = {
      ...process.env,
      PATH: `${hostBin}:${process.env.PATH ?? ""}`,
    };
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "--eval",
        'import("./apps/cli/src/index.ts").then(() => console.log("imported"))',
      ],
      { cwd: target, stdio: "pipe", timeout: 30_000 },
    );
    const convexCheck = execFileSync("pnpm", ["run", "check:convex-ai-files"], {
      cwd: target,
      encoding: "utf8",
      timeout: 30_000,
      env: supportedHostEnvironment,
    });
    expect(convexCheck).toContain(
      "Installed Convex AI targets match the pinned manifest.",
    );
    const agentPackCheck = execFileSync("pnpm", ["run", "check:agent-pack"], {
      cwd: target,
      encoding: "utf8",
      timeout: 30_000,
      env: supportedHostEnvironment,
    });
    expect(agentPackCheck).toContain(
      "Customer context, receipts, and MCP posture are valid.",
    );
    const recipes = spawnSync(
      "pnpm",
      ["--silent", "maestro", "--", "recipes", "list", "--json"],
      {
        cwd: target,
        encoding: "utf8",
        timeout: 30_000,
        env: supportedHostEnvironment,
      },
    );
    expect(recipes.status, recipes.stderr).toBe(0);
    expect(JSON.parse(recipes.stdout)).toMatchObject({
      exitClass: "success",
      data: { recipes: expect.arrayContaining([expect.any(Object)]) },
    });
    const addPreview = spawnSync(
      "pnpm",
      [
        "--silent",
        "maestro",
        "--",
        "add",
        "crud-business-entity",
        "--answer",
        "entityName=Request",
        "--answer",
        "canonicalOwner=record-management",
        "--answer",
        "tenantScope=workspace",
        "--answer",
        "sensitivity=internal",
        "--answer",
        "pii=none",
        "--answer",
        "exportMode=json",
        "--answer",
        "deleteMode=delete",
        "--answer",
        "retention=retain-until-workspace-delete",
        "--answer",
        "appendOnly=false",
        "--json",
      ],
      {
        cwd: target,
        encoding: "utf8",
        timeout: 30_000,
        env: supportedHostEnvironment,
      },
    );
    expect(addPreview.status, addPreview.stderr).toBe(0);
    expect(JSON.parse(addPreview.stdout)).toMatchObject({
      exitClass: "success",
      data: {
        confirmationCommand: expect.stringContaining("--privacy-reviewed"),
      },
    });
    const claudeSettings = join(target, ".claude/settings.json");
    const settingsBytes = readFileSync(claudeSettings, "utf8");
    try {
      writeFileSync(
        claudeSettings,
        `${JSON.stringify({ enableAllProjectMcpServers: false, theme: "dark" }, null, 2)}\n`,
      );
      expect(
        spawnSync("pnpm", ["run", "check:agent-pack"], {
          cwd: target,
          encoding: "utf8",
          timeout: 30_000,
          env: supportedHostEnvironment,
        }).status,
      ).not.toBe(0);
    } finally {
      writeFileSync(claudeSettings, settingsBytes);
    }
    const claudeInstructions = join(target, "CLAUDE.md");
    const claudeBytes = readFileSync(claudeInstructions, "utf8");
    try {
      writeFileSync(
        claudeInstructions,
        claudeBytes.replace("@AGENTS.md\n", ""),
      );
      expect(
        spawnSync("pnpm", ["run", "check:agent-pack"], {
          cwd: target,
          encoding: "utf8",
          timeout: 30_000,
          env: supportedHostEnvironment,
        }).status,
      ).not.toBe(0);
    } finally {
      writeFileSync(claudeInstructions, claudeBytes);
    }
    execFileSync("pnpm", ["run", "check:workflow-semantics"], {
      cwd: target,
      stdio: "pipe",
      timeout: 30_000,
      env: supportedHostEnvironment,
    });
    for (const gate of [
      "check:workflow-policy-snapshots",
      "check:workflow-principal-propagation",
    ]) {
      execFileSync("pnpm", ["run", gate], {
        cwd: target,
        stdio: "pipe",
        timeout: 30_000,
        env: supportedHostEnvironment,
      });
    }
    const maestroSkill = join(target, ".agents/skills/maestro/SKILL.md");
    const maestroBytes = readFileSync(maestroSkill, "utf8");
    try {
      writeFileSync(maestroSkill, `${maestroBytes}\ndrift\n`);
      expect(
        spawnSync("pnpm", ["run", "check:agent-pack"], {
          cwd: target,
          encoding: "utf8",
          timeout: 30_000,
          env: supportedHostEnvironment,
        }).status,
      ).not.toBe(0);
    } finally {
      writeFileSync(maestroSkill, maestroBytes);
    }
    const convexSkill = join(target, ".agents/skills/convex/SKILL.md");
    const convexBytes = readFileSync(convexSkill, "utf8");
    try {
      writeFileSync(convexSkill, `${convexBytes}\ndrift\n`);
      expect(
        spawnSync("pnpm", ["run", "check:convex-ai-files"], {
          cwd: target,
          encoding: "utf8",
          timeout: 30_000,
          env: supportedHostEnvironment,
        }).status,
      ).not.toBe(0);
    } finally {
      writeFileSync(convexSkill, convexBytes);
    }

    const preflight = spawnSync(
      "pnpm",
      ["--silent", "maestro", "--", "preflight", "--mode", "fake", "--json"],
      {
        cwd: target,
        encoding: "utf8",
        timeout: 30_000,
        env: supportedHostEnvironment,
      },
    );
    expect(preflight.error).toBeUndefined();
    expect(preflight.status, `${preflight.stdout}\n${preflight.stderr}`).toBe(
      0,
    );
    expect(JSON.parse(preflight.stdout)).toMatchObject({
      exitClass: "success",
      diagnostics: [],
      data: {
        safeToMutate: true,
        facts: {
          versions: {
            pack: expect.stringMatching(
              /^release:0\.2\.0-alpha\.2@[0-9a-f]{40}$/,
            ),
            cli: expect.stringMatching(
              /^release:0\.2\.0-alpha\.2@[0-9a-f]{40}$/,
            ),
            template: expect.stringMatching(
              /^release:0\.2\.0-alpha\.2@[0-9a-f]{40}$/,
            ),
          },
          versionsCompatible: true,
        },
      },
    });
    expect(preflight.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  }, 180_000);
});
