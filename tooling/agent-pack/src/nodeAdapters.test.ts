import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRepositoryContext } from "./repoContext.js";
import {
  createNodeExecFileAdapter,
  createNodePreflightRuntimeReader,
  nodePreflightFileSystem,
  type NodeExecFilePrimitive,
  type NodePreflightFileSystem,
} from "./nodeAdapters.js";

describe("Node Agent Pack adapters", () => {
  it("forces bounded shell-free execFile options and preserves ordinary exits", async () => {
    const primitive = vi.fn<NodeExecFilePrimitive>(
      (_file, _args, options, callback) => {
        expect(options).toMatchObject({
          cwd: "/repo",
          shell: false,
          timeout: 5_000,
          maxBuffer: 64_000,
          encoding: "utf8",
        });
        callback(
          Object.assign(new Error("failed"), { code: 2 }),
          "stdout",
          "stderr",
        );
      },
    );
    const execute = createNodeExecFileAdapter(primitive);

    await expect(
      execute("pnpm", ["check:agent-pack"], {
        cwd: "/repo",
        timeoutMs: 5_000,
        maxBufferBytes: 64_000,
      }),
    ).resolves.toEqual({ exitCode: 2, stdout: "stdout", stderr: "stderr" });
    expect(primitive).toHaveBeenCalledOnce();
  });

  it.each([
    ["ENOENT", { code: "ENOENT" }],
    ["timeout", { code: "ETIMEDOUT", killed: true }],
    ["signal", { code: null, signal: "SIGTERM" as const }],
  ])("maps %s execution failure to null status", async (_name, shape) => {
    const execute = createNodeExecFileAdapter(
      (_file, _args, _options, callback) => {
        callback(Object.assign(new Error("unavailable"), shape), "", "");
      },
    );
    await expect(
      execute("missing", ["--version"], {
        cwd: "/repo",
        timeoutMs: 1_000,
        maxBufferBytes: 1_000,
      }),
    ).resolves.toMatchObject({ exitCode: null });
  });

  it("rejects unbounded exec options before spawning", async () => {
    const primitive = vi.fn<NodeExecFilePrimitive>();
    const execute = createNodeExecFileAdapter(primitive);
    await expect(
      execute("pnpm", ["check:agent-pack"], {
        cwd: "/repo",
        timeoutMs: 0,
        maxBufferBytes: 64_000,
      }),
    ).resolves.toEqual({ exitCode: null, stdout: "", stderr: "" });
    expect(primitive).not.toHaveBeenCalled();
  });

  it("inspects the real repository fact model without exposing environment values", async () => {
    const repo = createRepositoryContext({
      cwd: "/repo",
      sourceRoot: ".",
      templateRoot: "../template",
      targetRoot: ".",
    });
    const files = new Map<string, string>([
      [
        "/repo/package.json",
        JSON.stringify({ name: "template", packageManager: "pnpm@10.12.1" }),
      ],
      [
        "/repo/packages/convex/package.json",
        JSON.stringify({
          dependencies: {
            convex: "1.42.1",
            "@convex-dev/workflow": "0.4.4",
            "@convex-dev/workpool": "0.4.7",
            "@confect/core": "9.1.5",
            effect: "3.21.4",
          },
        }),
      ],
      ["/repo/apps/cli/package.json", JSON.stringify({ private: true })],
      [
        "/repo/tooling/agent-pack/package.json",
        JSON.stringify({ private: true }),
      ],
      ["/template/package.json", JSON.stringify({ private: true })],
      ["/repo/agent-pack/skills/maestro/SKILL.md", "managed skill\n"],
      ["/repo/.agents/skills/maestro/SKILL.md", "managed skill\n"],
      ["/repo/template-instance.json", '{"name":"Fixture"}'],
    ]);
    const existing = new Set([
      "/repo",
      "/template",
      "/repo/node_modules",
      "/repo/agent-pack/skills/maestro",
      "/repo/.agents/skills/maestro/SKILL.md",
      ...files.keys(),
    ]);
    const fs: NodePreflightFileSystem = {
      readFile: async (path) => {
        const value = files.get(path);
        if (value === undefined)
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return value;
      },
      readDirectory: async (path) => {
        const prefix = `${path.replace(/\/$/, "")}/`;
        const entries = new Map<
          string,
          { readonly name: string; readonly kind: "file" | "directory" }
        >();
        for (const candidate of files.keys()) {
          if (!candidate.startsWith(prefix)) continue;
          const remainder = candidate.slice(prefix.length);
          const [name, ...rest] = remainder.split("/");
          if (name === undefined || name.length === 0) continue;
          entries.set(name, {
            name,
            kind: rest.length === 0 ? "file" : "directory",
          });
        }
        if (entries.size === 0)
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return [...entries.values()];
      },
      access: async (path) => {
        if (!existing.has(path))
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
      realpath: async (path) => (path === "/repo-link" ? "/repo" : path),
      statfs: async () => ({ bavail: 2_000, bsize: 1_000 }),
    };
    let registryExitCode: number | null = 0;
    let pnpmVersion = "10.12.1\n";
    let corepackAvailable = true;
    let gitVersion = "git version 2.50.0\n";
    const execute = vi.fn(async (file: string, args: readonly string[]) => {
      const command = `${file} ${args.join(" ")}`;
      const stdout: Record<string, string> = {
        "pnpm --version": pnpmVersion,
        "pnpm ping --registry https://registry.npmjs.org": "PONG\n",
        "corepack --version": "0.31.0\n",
        "git --version": gitVersion,
        "git worktree list --porcelain": "worktree /repo\n",
        "git rev-parse HEAD": `${"a".repeat(40)}\n`,
        "git rev-parse --show-toplevel": "/repo-link\n",
        "git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
        "git describe --tags --abbrev=0": "v1.0.0\n",
        "git status --porcelain=v1 -z --untracked-files=all": " M local.ts\0",
        "git status --porcelain=v1 -- docs/template/generated packages/template-core/src/generated":
          "",
      };
      if (command === "pnpm ping --registry https://registry.npmjs.org") {
        return {
          exitCode: registryExitCode,
          stdout: registryExitCode === 0 ? (stdout[command] ?? "") : "",
          stderr: registryExitCode === 0 ? "" : "registry unavailable",
        };
      }
      if (command === "corepack --version" && !corepackAvailable) {
        return { exitCode: null, stdout: "", stderr: "" };
      }
      return {
        exitCode: command in stdout ? 0 : null,
        stdout: stdout[command] ?? "",
        stderr: "",
      };
    });
    let currentNodeVersion = "v22.23.2";
    const runtime = createNodePreflightRuntimeReader({
      fs,
      execFile: execute,
      platform: () => "linux",
      architecture: () => "x64",
      nodeVersion: () => currentNodeVersion,
      environment: () => ({
        CONVEX_DEPLOYMENT: "secret-deployment-value",
        EMPTY_VALUE: "",
      }),
      now: () => "2026-07-25T12:00:00.000Z",
      portAvailable: async (port) => port !== 3000,
      workflowRules: [
        { id: "WF-DATE", subject: "primitive.Date.now", status: "supported" },
        {
          id: "WF-INTL",
          subject: "primitive.Intl",
          status: "intentionally-restricted",
        },
        {
          id: "WF-CRYPTO",
          subject: "primitive.crypto",
          status: "unsupported",
        },
      ],
      publishedWorkflowRuleIds: [
        "WF-DATE",
        "WF-INTL",
        "WF-CRYPTO",
        "WF-MISSING",
      ],
      policy: {
        supportedPlatforms: ["linux", "darwin", "win32"],
        supportedPnpmVersions: ["9.15.4"],
        minimumGitVersion: "2.31.0",
        minimumDiskBytes: 1_000_000,
        requiredPorts: [3000],
        metadataTimeoutMs: 1_000,
        maxBufferBytes: 64_000,
      },
    });

    const snapshot = await runtime.inspect({ mode: "fake" }, repo);
    expect(snapshot).toMatchObject({
      host: {
        os: "linux",
        architecture: "x64",
        osSupported: true,
        node: {
          current: "22.23.2",
          required: "^22.23.2 || ^24.0.0 || >=26.0.0",
          supported: true,
        },
        pnpm: { current: "10.12.1", required: "10.12.1", supported: true },
        corepack: "ready",
        git: { current: "2.50.0", supported: true, worktree: true },
      },
      prerequisites: {
        dependencies: "installed",
        disk: "ready",
        ports: "blocked",
      },
      repository: {
        role: "existing-app",
        commit: "a".repeat(40),
        gitRoot: "/repo-link",
        rootMatches: true,
        canonicalBase: "main",
        canonicalTag: "v1.0.0",
        dirty: true,
        generatedDrift: false,
        collisions: ["local.ts"],
        hostIntegration: "current",
      },
      network: "offline",
      auth: "not-required",
      versions: {
        pack: `git:${"a".repeat(40)}`,
        cli: `git:${"a".repeat(40)}`,
        template: `git:${"a".repeat(40)}`,
        convex: "1.42.1",
        workflow: "0.4.4",
        workpool: "0.4.7",
        confect: "9.1.5",
        effect: "3.21.4",
      },
      workflow: {
        status: "unsupported",
        accepted: ["Date.now"],
        restricted: ["Intl"],
        unsupported: ["crypto"],
        publishedDrift: true,
      },
      versionsCompatible: true,
      availableEnvironmentNames: ["CONVEX_DEPLOYMENT"],
      templateInstanceText: '{"name":"Fixture"}',
      observedAt: "2026-07-25T12:00:00.000Z",
    });
    expect(execute).not.toHaveBeenCalledWith(
      "pnpm",
      ["ping", "--registry", "https://registry.npmjs.org"],
      expect.anything(),
    );
    expect(JSON.stringify(snapshot)).not.toContain("secret-deployment-value");
    expect(execute).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.stringContaining("secret")]),
      expect.anything(),
    );

    const convexManifest = files.get("/repo/packages/convex/package.json");
    expect(convexManifest).toBeDefined();
    files.set(
      "/repo/packages/convex/package.json",
      JSON.stringify({
        dependencies: {
          convex: "1.42.1",
          "@convex-dev/workpool": "0.4.7",
          "@confect/core": "9.1.5",
          effect: "3.21.4",
        },
      }),
    );
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      versions: { workflow: "unavailable", workpool: "0.4.7" },
      versionsCompatible: true,
    });
    files.set("/repo/packages/convex/package.json", convexManifest ?? "{}");

    for (const [version, supported] of [
      ["v22.23.1", false],
      ["v22.23.2", true],
      ["v24.0.0", true],
      ["v25.0.0", false],
      ["v26.0.0", true],
      ["v27.1.0", true],
    ] as const) {
      currentNodeVersion = version;
      await expect(
        runtime.inspect({ mode: "fake" }, repo),
      ).resolves.toMatchObject({
        host: { node: { current: version.slice(1), supported } },
      });
    }
    currentNodeVersion = "v22.23.2";

    files.set(
      "/repo/.agents/skills/maestro/SKILL.md",
      "locally modified skill\n",
    );
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      repository: { hostIntegration: "stale" },
    });
    files.set("/repo/.agents/skills/maestro/SKILL.md", "managed skill\n");

    registryExitCode = 1;
    await expect(
      runtime.inspect({ mode: "test" }, repo),
    ).resolves.toMatchObject({
      network: "offline",
      auth: "unknown",
      observationDiagnostics: {
        auth: expect.stringContaining("does not authenticate"),
      },
    });

    corepackAvailable = false;
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      host: {
        pnpm: { current: "10.12.1", required: "10.12.1", supported: true },
        corepack: "missing",
      },
      versionsCompatible: true,
    });

    pnpmVersion = "9.15.4\n";
    gitVersion = "git version 2.20.0\n";
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      host: {
        pnpm: { current: "9.15.4", required: "10.12.1", supported: true },
        corepack: "missing",
        git: {
          current: "2.20.0",
          required: ">=2.31.0 with worktree support",
          supported: false,
        },
      },
      versionsCompatible: false,
    });
  });

  it("observes a real Git root, commit, dirty worktree, and target collision", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-preflight-git-"));
    await mkdir(join(root, "node_modules"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", packageManager: "pnpm@10.12.1" }),
    );
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "package.json"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Maestro Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "fixture",
      ],
      { cwd: root },
    );
    await writeFile(join(root, "dirty.ts"), "export {};\n");
    const realExec = createNodeExecFileAdapter();
    const runtime = createNodePreflightRuntimeReader({
      fs: nodePreflightFileSystem,
      execFile: (file, args, options) =>
        file === "git"
          ? realExec(file, args, options)
          : Promise.resolve({
              exitCode: 0,
              stdout:
                file === "pnpm" && args[0] === "--version"
                  ? "10.12.1\n"
                  : "ready\n",
              stderr: "",
            }),
      workflowRules: [],
      publishedWorkflowRuleIds: [],
      environment: () => ({}),
      policy: {
        supportedPlatforms: [process.platform],
        minimumGitVersion: "2.31.0",
        minimumDiskBytes: 0,
        requiredPorts: [],
        metadataTimeoutMs: 2_000,
        maxBufferBytes: 64_000,
      },
    });

    const snapshot = await runtime.inspect(
      { mode: "fake" },
      createRepositoryContext({ cwd: root }),
    );

    expect(snapshot.repository).toMatchObject({
      gitRoot: root,
      rootMatches: true,
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
      dirty: true,
      collisions: ["dirty.ts"],
    });
  });

  it("uses Git-committed release authority and rejects target self-certification", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-packaged-preflight-"));
    await Promise.all(
      [
        "node_modules",
        "apps/cli",
        "tooling/agent-pack",
        "packages/convex",
        "docs/template",
        ".agents/skills/maestro",
      ].map((path) => mkdir(join(root, path), { recursive: true })),
    );
    const skill = "managed packaged skill\n";
    const skillHash = createHash("sha256").update(skill).digest("hex");
    const releaseCommit = "b".repeat(40);
    const canonicalCommit = "d".repeat(40);
    const release = {
      version: "0.2.0-alpha.1",
      tag: "maestro-template-v0.2.0-alpha.1",
      sourceCommit: releaseCommit,
      sourceChecksum: `sha256:${"c".repeat(64)}`,
    };
    const canonicalManifest = JSON.stringify({ release });
    const manifestChecksum = `sha256:${createHash("sha256")
      .update(canonicalManifest)
      .digest("hex")}`;
    const templateInstance = (sourceChecksum = release.sourceChecksum) =>
      JSON.stringify({
        release: { ...release, sourceChecksum },
        ownership: {
          manifest: "releases/v0.2.0-alpha.1/manifest.json",
          manifestChecksum,
        },
      });
    await Promise.all([
      writeFile(
        join(root, "package.json"),
        JSON.stringify({
          packageManager: "pnpm@10.12.1",
          private: true,
          version: "9.9.9",
        }),
      ),
      writeFile(
        join(root, "apps/cli/package.json"),
        JSON.stringify({ private: true }),
      ),
      writeFile(
        join(root, "tooling/agent-pack/package.json"),
        JSON.stringify({ private: true }),
      ),
      writeFile(
        join(root, "packages/convex/package.json"),
        JSON.stringify({
          dependencies: {
            convex: "1.42.1",
            "@convex-dev/workflow": "0.4.4",
            "@convex-dev/workpool": "0.4.7",
            "@confect/core": "9.1.5",
            effect: "3.21.4",
          },
        }),
      ),
      writeFile(join(root, "template-instance.json"), templateInstance()),
      writeFile(
        join(root, "docs/template/customer-context.manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          files: [
            {
              path: ".agents/skills/maestro/SKILL.md",
              sha256: `sha256:${skillHash}`,
            },
          ],
        }),
      ),
      writeFile(join(root, ".agents/skills/maestro/SKILL.md"), skill),
    ]);
    const execute = async (file: string, args: readonly string[]) => {
      const command = `${file} ${args.join(" ")}`;
      const stdout: Record<string, string> = {
        "pnpm --version": "10.12.1\n",
        "pnpm ping --registry https://registry.npmjs.org": "PONG\n",
        "corepack --version": "0.31.0\n",
        "git --version": "git version 2.50.0\n",
        "git worktree list --porcelain": "worktree unavailable\n",
        "git rev-parse HEAD": `${canonicalCommit}\n`,
        "git rev-parse --show-toplevel": `${root}\n`,
        "git status --porcelain=v1 -z --untracked-files=all": "",
        "git status --porcelain=v1 -- docs/template/generated packages/template-core/src/generated":
          "",
      };
      return {
        exitCode: command in stdout ? 0 : null,
        stdout: stdout[command] ?? "",
        stderr: "",
      };
    };
    const runtime = createNodePreflightRuntimeReader({
      fs: nodePreflightFileSystem,
      execFile: execute,
      nodeVersion: () => "v22.23.2",
      workflowRules: [],
      publishedWorkflowRuleIds: [],
      environment: () => ({}),
      policy: {
        supportedPlatforms: [process.platform],
        minimumGitVersion: "2.31.0",
        minimumDiskBytes: 0,
        requiredPorts: [],
        metadataTimeoutMs: 2_000,
        maxBufferBytes: 256 * 1024,
      },
    });
    const repo = createRepositoryContext({ cwd: root });
    const version = `release:0.2.0-alpha.1@${releaseCommit}`;

    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      repository: { hostIntegration: "current" },
      versions: { pack: version, cli: version, template: version },
      versionsCompatible: true,
    });

    await writeFile(
      join(root, "template-instance.json"),
      templateInstance("invalid-checksum"),
    );
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      versions: {
        pack: "unavailable",
        cli: "unavailable",
        template: "unavailable",
      },
      versionsCompatible: false,
    });
    await writeFile(join(root, "template-instance.json"), templateInstance());

    await writeFile(
      join(root, "docs/template/customer-context.manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        files: [
          {
            path: ".agents/skills/maestro/SKILL.md",
            sha256: `sha256:${skillHash}`,
          },
          {
            path: ".agents/skills/maestro/references/host-safety.md",
            sha256: 42,
          },
        ],
      }),
    );
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      repository: { hostIntegration: "stale" },
    });
    await writeFile(
      join(root, "docs/template/customer-context.manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        files: [
          {
            path: ".agents/skills/maestro/SKILL.md",
            sha256: `sha256:${skillHash}`,
          },
        ],
      }),
    );

    await writeFile(
      join(root, ".agents/skills/maestro/SKILL.md"),
      "locally modified packaged skill\n",
    );
    await expect(
      runtime.inspect({ mode: "fake" }, repo),
    ).resolves.toMatchObject({
      repository: { hostIntegration: "stale" },
    });
  });
});
