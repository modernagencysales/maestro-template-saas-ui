import { describe, expect, it, vi } from "vitest";
import { createRepositoryContext } from "./repoContext.js";
import {
  createNodeExecFileAdapter,
  createNodePreflightRuntimeReader,
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
      ["/repo/apps/cli/package.json", JSON.stringify({ version: "1.2.3" })],
      [
        "/repo/tooling/agent-pack/package.json",
        JSON.stringify({ version: "1.2.3" }),
      ],
      ["/repo/template-instance.json", '{"name":"Fixture"}'],
    ]);
    const existing = new Set([
      "/repo",
      "/template",
      "/repo/node_modules",
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
      access: async (path) => {
        if (!existing.has(path))
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
      statfs: async () => ({ bavail: 2_000, bsize: 1_000 }),
    };
    const execute = vi.fn(async (file: string, args: readonly string[]) => {
      const command = `${file} ${args.join(" ")}`;
      const stdout: Record<string, string> = {
        "pnpm --version": "10.12.1\n",
        "corepack --version": "0.31.0\n",
        "git --version": "git version 2.50.0\n",
        "git worktree list --porcelain": "worktree /repo\n",
        "git rev-parse HEAD": "abc1234\n",
        "git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
        "git describe --tags --abbrev=0": "v1.0.0\n",
        "git status --porcelain=v1": " M local.ts\n",
        "git status --porcelain=v1 -- docs/template/generated packages/template-core/src/generated":
          "",
      };
      return {
        exitCode: command in stdout ? 0 : null,
        stdout: stdout[command] ?? "",
        stderr: "",
      };
    });
    const runtime = createNodePreflightRuntimeReader({
      fs,
      execFile: execute,
      platform: () => "linux",
      architecture: () => "x64",
      nodeVersion: () => "v22.20.0",
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
      publishedWorkflowRuleIds: ["WF-DATE", "WF-INTL", "WF-CRYPTO"],
      policy: {
        supportedPlatforms: ["linux", "darwin", "win32"],
        supportedNodeMajors: [22],
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
        node: { current: "22.20.0", required: "major 22", supported: true },
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
        commit: "abc1234",
        canonicalBase: "main",
        canonicalTag: "v1.0.0",
        dirty: true,
        generatedDrift: false,
        hostIntegration: "current",
      },
      network: "unknown",
      auth: "not-required",
      versions: {
        pack: "1.2.3",
        cli: "1.2.3",
        convex: "1.42.1",
        workflow: "0.4.4",
        workpool: "0.4.7",
        confect: "9.1.5",
        effect: "3.21.4",
      },
      workflow: {
        status: "restricted",
        accepted: ["Date.now"],
        restricted: ["Intl"],
        unsupported: ["crypto"],
        publishedDrift: false,
      },
      availableEnvironmentNames: ["CONVEX_DEPLOYMENT"],
      templateInstanceText: '{"name":"Fixture"}',
      observedAt: "2026-07-25T12:00:00.000Z",
    });
    expect(JSON.stringify(snapshot)).not.toContain("secret-deployment-value");
    expect(execute).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.stringContaining("secret")]),
      expect.anything(),
    );
  });
});
