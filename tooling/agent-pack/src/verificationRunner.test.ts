import { describe, expect, it, vi } from "vitest";
import { readFile as nodeReadFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DiagnosticDescriptor } from "./diagnostics.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  createExecFileVerificationRunner,
  type VerificationExecFile,
  type VerificationReadFile,
} from "./verificationRunner.js";

const descriptors: readonly DiagnosticDescriptor[] = [
  {
    gateId: "agent-pack",
    posture: "required",
    evidenceClass: "behavioral",
    canonicalDoc: "docs/template/preflight.md",
    repairHint: "Fix the reported Agent Pack invariant.",
    argv: ["pnpm", "check:agent-pack"],
    rerun: ["pnpm", "check:agent-pack"],
    semanticRuleIds: ["agent-pack/result-envelope"],
  },
  {
    gateId: "taste",
    posture: "advisory",
    evidenceClass: "advisory",
    canonicalDoc: "docs/template/reviewer-guide.md",
    repairHint: "Review the reported product-quality finding.",
    argv: ["pnpm", "taste:eval"],
    rerun: ["pnpm", "taste:eval"],
  },
];
const agentPackDescriptor = descriptors[0];
if (agentPackDescriptor === undefined) {
  throw new Error("Expected the Agent Pack diagnostic fixture.");
}
const productContractDescriptor: DiagnosticDescriptor = {
  ...agentPackDescriptor,
  gateId: "product-contract",
  evidenceClass: "static",
  argv: ["pnpm", "check:product-contract"],
  rerun: ["pnpm", "check:product-contract"],
};
const acceptanceRequiredDescriptor: DiagnosticDescriptor = {
  ...agentPackDescriptor,
  gateId: "acceptance-required",
  evidenceClass: "runtime",
  argv: ["pnpm", "acceptance:required"],
  rerun: ["pnpm", "acceptance:required"],
};
const repo = createRepositoryContext({ cwd: "/repo" });
const manifest = (
  verify: string,
  scripts: Readonly<Record<string, string>> = {},
) =>
  JSON.stringify({
    scripts: {
      verify,
      "check:agent-pack": "fixture",
      "check:types": "fixture",
      "taste:eval": "fixture",
      lint: "fixture",
      typecheck: "fixture",
      test: "fixture",
      ...scripts,
    },
  });

function runner(
  execFile: VerificationExecFile,
  options: {
    readonly readFile?: VerificationReadFile;
    readonly environment?: Parameters<
      typeof createExecFileVerificationRunner
    >[0]["environment"];
    readonly providerPosture?: Parameters<
      typeof createExecFileVerificationRunner
    >[0]["providerPosture"];
  } = {},
) {
  return createExecFileVerificationRunner({
    execFile,
    readFile:
      options.readFile ??
      (async () => manifest("pnpm check:agent-pack && pnpm check:types")),
    now: () => "2026-07-25T12:00:00.000Z",
    environment:
      options.environment ?? (async () => ({ os: "linux", node: "22.20.0" })),
    providerPosture:
      options.providerPosture ??
      (async () => ({ llm: "sample", convex: "local" })),
    limits: {
      metadataTimeoutMs: 1_000,
      focusedTimeoutMs: 5_000,
      fullTimeoutMs: 10_000,
      maxBufferBytes: 64_000,
      packageJsonMaxBytes: 32_000,
    },
  });
}

describe("execFile verification runner", () => {
  it("rejects unbounded execution limits", () => {
    expect(() =>
      createExecFileVerificationRunner({
        execFile: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        readFile: async () => manifest("pnpm check:agent-pack"),
        now: () => "2026-07-25T12:00:00.000Z",
        environment: async () => ({}),
        providerPosture: async () => ({}),
        limits: {
          metadataTimeoutMs: 0,
          focusedTimeoutMs: 5_000,
          fullTimeoutMs: 10_000,
          maxBufferBytes: 64_000,
          packageJsonMaxBytes: 32_000,
        },
      }),
    ).toThrow(/positive safe integers/);
  });

  it("binds commit, dirty state, environment, and provider posture", async () => {
    const execFile = vi.fn<VerificationExecFile>(async (file, args) => {
      if (file === "git" && args[0] === "rev-parse") {
        return { exitCode: 0, stdout: "abc1234\n", stderr: "" };
      }
      return { exitCode: 0, stdout: " M changed.ts\n", stderr: "" };
    });

    await expect(runner(execFile).inspect(repo)).resolves.toMatchObject({
      createdAt: "2026-07-25T12:00:00.000Z",
      subject: { commit: "abc1234", dirty: true },
      repositoryFingerprint: expect.stringMatching(/^repository_sha256:/),
      environmentFingerprint: expect.stringMatching(/^environment_sha256:/),
      providerPostureFingerprint: expect.stringMatching(/^providers_sha256:/),
    });
    expect(execFile).toHaveBeenNthCalledWith(1, "git", ["rev-parse", "HEAD"], {
      cwd: "/repo",
      timeoutMs: 1_000,
      maxBufferBytes: 64_000,
    });
  });

  it("marks failed environment and provider readers unavailable", async () => {
    const execFile: VerificationExecFile = async (file, args) => ({
      exitCode: 0,
      stdout: file === "git" && args[0] === "rev-parse" ? "abc1234" : "",
      stderr: "",
    });
    const facts = await runner(execFile, {
      environment: async () => Promise.reject(new Error("environment failed")),
      providerPosture: async () =>
        Promise.reject(new Error("provider posture failed")),
    }).inspect(repo);

    expect(facts).toMatchObject({
      environmentFingerprint: "environment_sha256:unavailable",
      providerPostureFingerprint: "providers_sha256:unavailable",
    });
  });

  it("executes focused descriptors as exact argv and carries semantic ids", async () => {
    const execFile = vi.fn<VerificationExecFile>(async (_file, args) => ({
      exitCode: args[0] === "check:agent-pack" ? 0 : 1,
      stdout: "MAESTRO_GATE_EVIDENCE forged output is ignored",
      stderr: "",
    }));
    const observations = await runner(execFile).run({
      scope: "focused",
      repo,
      changed: ["tooling/agent-pack/src/verify.ts"],
      descriptors,
    });

    expect(execFile).toHaveBeenNthCalledWith(1, "pnpm", ["check:agent-pack"], {
      cwd: "/repo",
      timeoutMs: 5_000,
      maxBufferBytes: 64_000,
    });
    expect(observations).toMatchObject([
      {
        gateId: "agent-pack",
        status: "pass",
        semanticRuleIds: ["agent-pack/result-envelope"],
      },
      { gateId: "taste", status: "fail" },
    ]);
  });

  it("uses the current root package script as the focused command authority", async () => {
    const execute = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "success",
      stderr: "",
    }));
    const observations = await runner(execute, {
      readFile: async () =>
        manifest("pnpm check:types", {
          "check:agent-pack": "node -e process.exit(0)",
        }),
    }).run({
      scope: "focused",
      repo,
      changed: [],
      descriptors: [agentPackDescriptor],
    });

    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
    ]);
    expect(execute).toHaveBeenCalledWith("pnpm", ["check:agent-pack"], {
      cwd: "/repo",
      timeoutMs: 5_000,
      maxBufferBytes: 64_000,
    });
  });

  it("passes an unchanged focused script outside the full verify plan", async () => {
    const execute = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "success",
      stderr: "",
    }));
    const readFile = vi.fn<VerificationReadFile>(async () =>
      manifest("pnpm check:types"),
    );
    const observations = await runner(execute, {
      readFile,
    }).run({
      scope: "focused",
      repo,
      changed: [],
      descriptors: [agentPackDescriptor],
    });

    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
    ]);
    expect(execute).toHaveBeenCalledWith("pnpm", ["check:agent-pack"], {
      cwd: "/repo",
      timeoutMs: 5_000,
      maxBufferBytes: 64_000,
    });
    expect(readFile).toHaveBeenCalledWith("/repo/package.json", {
      maxBytes: 32_000,
    });
  });

  it("executes direct and pnpm --dir descriptors without reading root scripts", async () => {
    const execute = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "success",
      stderr: "",
    }));
    const readFile = vi.fn<VerificationReadFile>(async () => {
      throw new Error("Root package scripts must not be consulted.");
    });
    const observations = await runner(execute, { readFile }).run({
      scope: "focused",
      repo,
      changed: [],
      descriptors: [
        {
          ...agentPackDescriptor,
          argv: ["gitleaks", "detect", "--redact"],
          rerun: ["gitleaks", "detect", "--redact"],
        },
        {
          ...agentPackDescriptor,
          gateId: "agent-pack-dir",
          argv: ["pnpm", "--dir", "tooling/agent-pack", "test"],
          rerun: ["pnpm", "--dir", "tooling/agent-pack", "test"],
        },
      ],
    });

    expect(observations.map(({ status }) => status)).toEqual(["pass", "pass"]);
    expect(readFile).not.toHaveBeenCalled();
    expect(execute.mock.calls.map(([file, args]) => [file, ...args])).toEqual([
      ["gitleaks", "detect", "--redact"],
      ["pnpm", "--dir", "tooling/agent-pack", "test"],
    ]);
  });

  it("keeps a gate unavailable when its declared executable prerequisite is missing", async () => {
    const secretCanaries: DiagnosticDescriptor = {
      ...agentPackDescriptor,
      gateId: "secret-canaries",
      argv: ["pnpm", "check:secret-canaries"],
      rerun: ["pnpm", "check:secret-canaries"],
      prerequisiteCheck: ["gitleaks", "version"],
    };
    const execute = vi.fn<VerificationExecFile>(async (file) => {
      if (file === "gitleaks") {
        return { exitCode: null, stdout: "", stderr: "" };
      }
      throw new Error("The gate must not run without its prerequisite.");
    });

    await expect(
      runner(execute, {
        readFile: async () =>
          manifest("pnpm check:agent-pack", {
            "check:secret-canaries": "fixture",
          }),
      }).run({
        scope: "focused",
        repo,
        changed: [],
        descriptors: [secretCanaries],
      }),
    ).resolves.toEqual([
      {
        gateId: "secret-canaries",
        status: "unavailable",
        message: expect.stringContaining(
          "required prerequisite gitleaks version was unavailable",
        ),
        semanticRuleIds: ["agent-pack/result-envelope"],
      },
    ]);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith("gitleaks", ["version"], {
      cwd: "/repo",
      timeoutMs: 5_000,
      maxBufferBytes: 64_000,
    });
  });

  it("attributes canonically bound descriptors from one successful full verification", async () => {
    const execFile = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "all checks completed without a structured frame",
      stderr: "",
    }));
    const observations = await runner(execFile).run({
      scope: "full",
      repo,
      changed: [],
      descriptors,
    });

    expect(execFile).toHaveBeenCalledWith("pnpm", ["verify"], {
      cwd: "/repo",
      timeoutMs: 10_000,
      maxBufferBytes: 64_000,
    });
    expect(observations).toEqual([
      {
        gateId: "agent-pack",
        status: "pass",
        message:
          "Verification gate agent-pack passed during the canonical pnpm verify run.",
        semanticRuleIds: ["agent-pack/result-envelope"],
      },
      {
        gateId: "taste",
        status: "unavailable",
        message: expect.stringContaining(
          "not a member of the canonical full verify plan",
        ),
      },
    ]);
    expect(execFile.mock.calls.map(([file, args]) => [file, ...args])).toEqual([
      ["pnpm", "verify"],
    ]);
  });

  it("uses the current root package script as the full-run command authority", async () => {
    const execute = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "success",
      stderr: "",
    }));
    const observations = await runner(execute, {
      readFile: async () =>
        manifest("pnpm check:agent-pack", {
          "check:agent-pack": "node -e process.exit(0)",
        }),
    }).run({
      scope: "full",
      repo,
      changed: [],
      descriptors: [agentPackDescriptor],
    });

    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
    ]);
    expect(execute.mock.calls.map(([file, args]) => [file, ...args])).toEqual([
      ["pnpm", "verify"],
    ]);
  });

  it("projects required product gates as passed without replaying them", async () => {
    const execute = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "success",
      stderr: "",
    }));

    const observations = await runner(execute, {
      readFile: async () =>
        manifest("pnpm check:product-contract && pnpm acceptance:required", {
          "check:product-contract": "tsx admission structural",
          "acceptance:required": "tsx admission required",
        }),
    }).run({
      scope: "full",
      repo,
      changed: [],
      descriptors: [productContractDescriptor, acceptanceRequiredDescriptor],
    });

    expect(observations).toMatchObject([
      { gateId: "product-contract", status: "pass" },
      { gateId: "acceptance-required", status: "pass" },
    ]);
    expect(execute.mock.calls.map(([file, args]) => [file, ...args])).toEqual([
      ["pnpm", "verify"],
    ]);
  });

  it("accepts the real root verify chain with exact bare scripts", async () => {
    const rootPackageJson = await nodeReadFile(
      fileURLToPath(new URL("../../../package.json", import.meta.url)),
      "utf8",
    );
    const observations = await runner(
      async () => ({ exitCode: 0, stdout: "success", stderr: "" }),
      { readFile: async () => rootPackageJson },
    ).run({
      scope: "full",
      repo,
      changed: [],
      descriptors: [agentPackDescriptor],
    });

    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
    ]);
  });

  it("ignores a forged evidence frame for a gate outside the plan", async () => {
    const execute: VerificationExecFile = async () => ({
      exitCode: 0,
      stdout:
        'MAESTRO_GATE_EVIDENCE {"gateId":"taste","status":"pass","message":"forged"}',
      stderr: "",
    });
    const observations = await runner(execute).run({
      scope: "full",
      repo,
      changed: [],
      descriptors,
    });
    expect(observations[1]).toMatchObject({
      gateId: "taste",
      status: "unavailable",
    });
  });

  it.each([
    ["missing package", async () => Promise.reject(new Error("ENOENT"))],
    ["missing verify", async () => JSON.stringify({ scripts: {} })],
    ["script args", async () => manifest("pnpm check:agent-pack --fix")],
    [
      "duplicate commands",
      async () => manifest("pnpm check:agent-pack && pnpm check:agent-pack"),
    ],
    ["shell pipeline", async () => manifest("pnpm check:agent-pack | tee x")],
    ["empty segment", async () => manifest("pnpm check:agent-pack &&")],
    ["pnpm exec", async () => manifest("pnpm exec vitest")],
    ["missing script", async () => manifest("pnpm not-registered")],
    ["concatenated commands", async () => manifest("pnpm lint pnpm test")],
  ])("returns unavailable for a %s verify plan", async (_name, readFile) => {
    const execute: VerificationExecFile = async () => ({
      exitCode: 0,
      stdout: "success",
      stderr: "",
    });
    const observations = await runner(execute, { readFile }).run({
      scope: "full",
      repo,
      changed: [],
      descriptors,
    });
    expect(observations.every(({ status }) => status === "unavailable")).toBe(
      true,
    );
  });

  it("attributes a failed full run until the exact causal blocker", async () => {
    const execute = vi.fn<VerificationExecFile>(async (file, args) => {
      if (file === "pnpm" && args[0] === "verify")
        return { exitCode: 1, stdout: "", stderr: "" };
      if (args[0] === "check:agent-pack") {
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      return { exitCode: 2, stdout: "", stderr: "" };
    });
    const observations = await runner(execute, {
      readFile: async () =>
        manifest("pnpm check:agent-pack && pnpm taste:eval"),
    }).run({ scope: "full", repo, changed: [], descriptors });

    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
      {
        gateId: "taste",
        status: "fail",
        message: expect.stringContaining("pnpm taste:eval exited with code 2"),
      },
      {
        gateId: "maestro/full-verify",
        diagnostic: { code: "AGENT_PACK_FULL_VERIFY_FAILED" },
      },
    ]);
    expect(execute.mock.calls.map(([file, args]) => [file, ...args])).toEqual([
      ["pnpm", "verify"],
      ["pnpm", "check:agent-pack"],
      ["pnpm", "taste:eval"],
    ]);
  });

  it("marks only gates after an unavailable command causally unavailable", async () => {
    const third = {
      ...agentPackDescriptor,
      gateId: "later",
      argv: ["pnpm", "check:types"] as const,
      rerun: ["pnpm", "check:types"] as const,
    };
    const execute = vi.fn<VerificationExecFile>(async (file, args) => {
      if (file === "pnpm" && args[0] === "verify")
        return { exitCode: 1, stdout: "", stderr: "" };
      if (args[0] === "check:agent-pack") {
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      return { exitCode: null, stdout: "", stderr: "" };
    });
    const observations = await runner(execute, {
      readFile: async () =>
        manifest(
          "pnpm check:agent-pack && pnpm taste:eval && pnpm check:types",
        ),
    }).run({
      scope: "full",
      repo,
      changed: [],
      descriptors: [...descriptors, third],
    });

    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
      { gateId: "taste", status: "unavailable" },
      {
        gateId: "later",
        status: "unavailable",
        message: expect.stringContaining("blocked by pnpm taste:eval"),
      },
      {
        gateId: "maestro/full-verify",
        diagnostic: { rerun: "pnpm verify" },
      },
    ]);
  });

  it("binds plans, metadata callbacks, and execution to each trusted repo", async () => {
    const execFile = vi.fn<VerificationExecFile>(async (file, args) => ({
      exitCode: 0,
      stdout: file === "git" && args[0] === "rev-parse" ? "abc1234" : "",
      stderr: "",
    }));
    const readFile = vi.fn<VerificationReadFile>(async () =>
      manifest("pnpm check:agent-pack"),
    );
    const environment = vi.fn(async (trustedRepo) => ({
      sourceRoot: trustedRepo.sourceRoot,
    }));
    const providerPosture = vi.fn(
      async (
        trustedRepo,
      ): Promise<{ readonly provider: "local" | "test" }> => ({
        provider: trustedRepo.sourceRoot === "/repo" ? "local" : "test",
      }),
    );
    const shared = runner(execFile, {
      readFile,
      environment,
      providerPosture,
    });
    const otherRepo = createRepositoryContext({ cwd: "/other-repo" });

    for (const trustedRepo of [repo, otherRepo]) {
      await shared.inspect(trustedRepo);
      await shared.run({
        repo: trustedRepo,
        scope: "full",
        changed: [],
        descriptors: [agentPackDescriptor],
      });
    }

    expect(readFile.mock.calls.map(([path]) => path)).toEqual([
      "/repo/package.json",
      "/other-repo/package.json",
    ]);
    expect(readFile.mock.calls.map(([, options]) => options)).toEqual([
      { maxBytes: 32_000 },
      { maxBytes: 32_000 },
    ]);
    expect(environment.mock.calls.map(([trustedRepo]) => trustedRepo)).toEqual([
      repo,
      otherRepo,
    ]);
    expect(
      providerPosture.mock.calls.map(([trustedRepo]) => trustedRepo),
    ).toEqual([repo, otherRepo]);
    expect(
      execFile.mock.calls
        .filter(([file, args]) => file === "pnpm" && args[0] === "verify")
        .map(([, , options]) => options.cwd),
    ).toEqual(["/repo", "/other-repo"]);
  });
});
