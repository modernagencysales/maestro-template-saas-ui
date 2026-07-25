import { describe, expect, it, vi } from "vitest";
import type { DiagnosticDescriptor } from "./diagnostics.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  VERIFICATION_EVIDENCE_PREFIX,
  createExecFileVerificationRunner,
  type VerificationExecFile,
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

function runner(execFile: VerificationExecFile) {
  return createExecFileVerificationRunner({
    execFile,
    now: () => "2026-07-25T12:00:00.000Z",
    environment: async () => ({ os: "linux", node: "22.20.0" }),
    providerPosture: async () => ({ llm: "sample", convex: "local" }),
    limits: {
      metadataTimeoutMs: 1_000,
      focusedTimeoutMs: 5_000,
      fullTimeoutMs: 10_000,
      maxBufferBytes: 64_000,
    },
  });
}

describe("execFile verification runner", () => {
  it("rejects unbounded execution limits", () => {
    expect(() =>
      createExecFileVerificationRunner({
        execFile: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        now: () => "2026-07-25T12:00:00.000Z",
        environment: async () => ({}),
        providerPosture: async () => ({}),
        limits: {
          metadataTimeoutMs: 0,
          focusedTimeoutMs: 5_000,
          fullTimeoutMs: 10_000,
          maxBufferBytes: 64_000,
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
      environmentFingerprint: expect.stringMatching(/^environment_sha256:/),
      providerPostureFingerprint: expect.stringMatching(/^providers_sha256:/),
    });
    expect(execFile).toHaveBeenNthCalledWith(1, "git", ["rev-parse", "HEAD"], {
      cwd: "/repo",
      timeoutMs: 1_000,
      maxBufferBytes: 64_000,
    });
  });

  it("executes focused descriptors as exact argv without a shell", async () => {
    const execFile = vi.fn<VerificationExecFile>(async (_file, args) => ({
      exitCode: args[0] === "check:agent-pack" ? 0 : 1,
      stdout: "",
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
    expect(execFile).toHaveBeenNthCalledWith(2, "pnpm", ["taste:eval"], {
      cwd: "/repo",
      timeoutMs: 5_000,
      maxBufferBytes: 64_000,
    });
    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
      { gateId: "taste", status: "fail" },
    ]);
  });

  it("binds full scope to just verify and parses per-gate evidence", async () => {
    const execFile = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 1,
      stdout: [
        `${VERIFICATION_EVIDENCE_PREFIX}{"gateId":"agent-pack","status":"pass","message":"Passed."}`,
        `${VERIFICATION_EVIDENCE_PREFIX}{"gateId":"taste","status":"fail","message":"Review suggested."}`,
      ].join("\n"),
      stderr: "",
    }));
    const observations = await runner(execFile).run({
      scope: "full",
      repo,
      changed: [],
      descriptors,
    });

    expect(execFile).toHaveBeenCalledOnce();
    expect(execFile).toHaveBeenCalledWith("just", ["verify"], {
      cwd: "/repo",
      timeoutMs: 10_000,
      maxBufferBytes: 64_000,
    });
    expect(observations).toMatchObject([
      { gateId: "agent-pack", status: "pass" },
      { gateId: "taste", status: "fail" },
    ]);
  });

  it.each([
    ["missing executable", async () => Promise.reject(new Error("ENOENT"))],
    [
      "unparsable full evidence",
      async () => ({ exitCode: 0, stdout: "all good", stderr: "" }),
    ],
  ])("returns unavailable for %s", async (_name, execute) => {
    const observations = await runner(execute).run({
      scope: "full",
      repo,
      changed: [],
      descriptors,
    });
    expect(observations).toEqual(
      descriptors.map(({ gateId }) => ({
        gateId,
        status: "unavailable",
        message: `Verification evidence for ${gateId} is unavailable.`,
      })),
    );
  });

  it("derives focused cwd from each trusted repository context", async () => {
    const execFile = vi.fn<VerificationExecFile>(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const sharedRunner = runner(execFile);
    const otherRepo = createRepositoryContext({ cwd: "/other-repo" });

    await sharedRunner.run({
      repo,
      scope: "focused",
      changed: [],
      descriptors: [descriptors[0]!],
    });
    await sharedRunner.run({
      repo: otherRepo,
      scope: "focused",
      changed: [],
      descriptors: [descriptors[0]!],
    });

    expect(execFile.mock.calls.map((call) => call[2].cwd)).toEqual([
      "/repo",
      "/other-repo",
    ]);
  });
});
