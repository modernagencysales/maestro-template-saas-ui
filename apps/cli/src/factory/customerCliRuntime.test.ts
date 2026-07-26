import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];
const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const digest = (path: string): string =>
  `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
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
    "git",
    [
      "-C",
      taggedReleaseRoot,
      "tag",
      "maestro-template-v0.2.0-alpha.1",
      (
        JSON.parse(
          readFileSync(
            join(taggedReleaseRoot, "releases/v0.2.0-alpha.1/manifest.json"),
            "utf8",
          ),
        ) as { readonly release: { readonly sourceCommit: string } }
      ).release.sourceCommit,
    ],
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
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
afterAll(() => {
  if (taggedReleaseParent)
    rmSync(taggedReleaseParent, { recursive: true, force: true });
});

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
    expect(created.exitCode, created.stderr).toBe(0);

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
    const manifestPath = join(
      releaseRoot,
      "releases/v0.2.0-alpha.1/manifest.json",
    );
    const releaseManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      readonly release: Record<string, unknown>;
    };
    expect(instance).toMatchObject({
      release: releaseManifest.release,
      ownership: {
        manifest: "releases/v0.2.0-alpha.1/manifest.json",
        manifestChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
      privacy: {
        privacyDocument: "docs/template/agent-pack-privacy.md",
      },
    });
    expect(instance.ownership.manifestChecksum).toBe(digest(manifestPath));
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

  it("installs, imports, preflights, and supervises fake start without factory-only packages", async () => {
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
    expect(created.exitCode, created.stderr).toBe(0);

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
    expect(preflight.status, `${preflight.stdout}\n${preflight.stderr}`).toBe(
      0,
    );
    expect(() => JSON.parse(preflight.stdout)).not.toThrow();
    expect(preflight.stderr).not.toContain("ERR_MODULE_NOT_FOUND");

    const start = spawn(
      "pnpm",
      ["dlx", "pnpm@10.12.1", "maestro", "--", "start", "--mode", "fake"],
      {
        cwd: target,
        stdio: ["ignore", "pipe", "pipe"],
        env: supportedHostEnvironment,
      },
    );
    let stdout = "";
    let stderr = "";
    start.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    start.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    try {
      await waitUntil(
        () =>
          stderr.includes("[maestro] URL: http://127.0.0.1:5173") &&
          stderr.includes("[maestro] Build Readiness: http://127.0.0.1:4174/"),
        60_000,
        () =>
          `fake start did not become ready (exit=${String(start.exitCode)}):\nstdout=${stdout}\nstderr=${stderr}`,
      );
      await expect(
        fetch("http://127.0.0.1:5173/health"),
      ).resolves.toMatchObject({ status: 200 });
      await expect(fetch("http://127.0.0.1:4174/")).resolves.toMatchObject({
        status: 200,
      });
      const cliPid = findDescendant(start.pid, "apps/cli/src/index.ts");
      if (cliPid === undefined)
        throw new Error("the supervised customer CLI process was not found");
      process.kill(cliPid, "SIGINT");
      const completion = await waitForExit(start, 15_000);
      expect(completion, stderr).toMatchObject({ code: 0, signal: null });
      expect(stdout).toContain("stopped cleanly");
      expect(stderr).not.toContain("ERR_MODULE_NOT_FOUND");
      await expect(portAvailable(5173)).resolves.toBe(true);
      await expect(portAvailable(4174)).resolves.toBe(true);
    } finally {
      if (start.exitCode === null && start.signalCode === null)
        start.kill("SIGKILL");
    }
  }, 180_000);
});

async function waitUntil(
  condition: () => boolean,
  timeoutMs: number,
  message: () => string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(message());
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function waitForExit(
  child: ReturnType<typeof spawn>,
  timeoutMs: number,
): Promise<{ readonly code: number | null; readonly signal: string | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("fake start did not stop within its deadline")),
      timeoutMs,
    );
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function portAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

function findDescendant(
  rootPid: number | undefined,
  commandMarker: string,
): number | undefined {
  if (rootPid === undefined) return undefined;
  const processes = execFileSync("ps", ["-eo", "pid=,ppid=,args="], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      command: match[3] ?? "",
    }));
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of processes) {
      if (
        descendants.has(candidate.parentPid) &&
        !descendants.has(candidate.pid)
      ) {
        descendants.add(candidate.pid);
        changed = true;
      }
    }
  }
  return processes
    .filter(
      ({ pid, command }) =>
        descendants.has(pid) && command.includes(commandMarker),
    )
    .at(-1)?.pid;
}
