import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];
const repositoryRoot = resolve(import.meta.dirname, "../../../..");
let taggedReleaseParent: string | undefined;
let taggedReleaseRoot: string | undefined;
const taggedRepository = (): string => {
  if (taggedReleaseRoot) return taggedReleaseRoot;
  taggedReleaseParent = mkdtempSync(join(tmpdir(), "maestro-tagged-release-"));
  taggedReleaseRoot = join(taggedReleaseParent, "release");
  execFileSync(
    "git",
    ["clone", "--quiet", "--shared", repositoryRoot, taggedReleaseRoot],
    { stdio: "pipe" },
  );
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
afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
}, 60_000);
afterAll(async () => {
  if (taggedReleaseParent)
    await rm(taggedReleaseParent, { recursive: true, force: true });
}, 60_000);

describe("materialized customer CLI runtime closure", () => {
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

    execFileSync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      { cwd: target, stdio: "pipe", timeout: 120_000 },
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

  it("installs, imports, and passes immutable customer preflight", async () => {
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

    execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: target,
      stdio: "pipe",
      timeout: 120_000,
    });
    expect(existsSync(join(target, ".git"))).toBe(false);
    execFileSync("git", ["init", "--quiet"], { cwd: target });
    execFileSync("pnpm", ["run", "prepare"], {
      cwd: target,
      stdio: "pipe",
      timeout: 30_000,
    });
    expect(existsSync(join(target, ".git/hooks/pre-commit"))).toBe(true);
    expect(existsSync(join(target, ".git/hooks/pre-push"))).toBe(true);
    execFileSync("git", ["config", "user.email", "fixture@localhost"], {
      cwd: target,
    });
    execFileSync("git", ["config", "user.name", "Fixture"], { cwd: target });
    execFileSync("git", ["add", "."], { cwd: target });
    execFileSync("git", ["commit", "--quiet", "--no-verify", "-m", "fixture"], {
      cwd: target,
    });
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      ".agents/skills/maestro/SKILL.md",
      ".agents/skills/maestro-convex/SKILL.md",
      ".claude/settings.json",
      "skills-lock.json",
      "packages/convex/convex/_generated/ai/ai-files.state.json",
      "packages/convex/convex/_generated/ai/guidelines.md",
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
    for (const path of ["agent-pack", "tooling/stack", "tooling/release"])
      expect(existsSync(join(target, path))).toBe(false);
    const customerPackage = JSON.parse(
      readFileSync(join(target, "package.json"), "utf8"),
    ) as { readonly scripts: Readonly<Record<string, string>> };
    expect(customerPackage.scripts.verify).toContain(
      "pnpm check:convex-ai-files",
    );
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
      [
        "dlx",
        "pnpm@10.12.1",
        "--silent",
        "maestro",
        "--",
        "preflight",
        "--mode",
        "fake",
        "--json",
      ],
      {
        cwd: target,
        encoding: "utf8",
        timeout: 30_000,
        env: supportedHostEnvironment,
      },
    );
    expect(preflight.error).toBeUndefined();
    expect(preflight.status).toBe(0);
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
