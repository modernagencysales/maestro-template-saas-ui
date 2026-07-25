import { describe, expect, it, vi } from "vitest";
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
const repo = createRepositoryContext({ cwd: "/repo" });
const manifest = (verify: string) => JSON.stringify({ scripts: { verify } });

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

  it("trusts exact verify-plan membership after unstructured success", async () => {
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

    expect(execFile).toHaveBeenCalledWith("just", ["verify"], {
      cwd: "/repo",
      timeoutMs: 10_000,
      maxBufferBytes: 64_000,
    });
    expect(observations).toEqual([
      {
        gateId: "agent-pack",
        status: "pass",
        message: "Verification gate agent-pack passed.",
        semanticRuleIds: ["agent-pack/result-envelope"],
      },
      {
        gateId: "taste",
        status: "unavailable",
        message: "Verification evidence for taste is unavailable.",
      },
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

  it.each([1, null] as const)(
    "returns unavailable when just verify exits %s",
    async (exitCode) => {
      const observations = await runner(async () => ({
        exitCode,
        stdout: "",
        stderr: "",
      })).run({ scope: "full", repo, changed: [], descriptors });
      expect(observations.every(({ status }) => status === "unavailable")).toBe(
        true,
      );
    },
  );

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
        descriptors: [descriptors[0]!],
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
        .filter(([file]) => file === "just")
        .map(([, , options]) => options.cwd),
    ).toEqual(["/repo", "/other-repo"]);
  });
});
