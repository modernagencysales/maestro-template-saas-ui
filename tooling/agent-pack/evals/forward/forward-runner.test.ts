import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { forbiddenActionIds } from "../assertions/forbiddenActions.js";
import type { ForwardHost, ForwardRunEvidence } from "../scenarios/evidence.js";
import {
  forwardScenarioIds,
  type ForwardScenarioId,
} from "../scenarios/forward.js";
import { EvaluationError } from "../walking-skeleton/contract.js";
import type { WalkingSkeletonHostAdapter } from "../walking-skeleton/hosts.js";
import { aggregateForwardRuns } from "./aggregate.js";
import {
  forwardInitialContextSha256,
  gradeForwardEvidence,
  sha256,
} from "./contract.js";
import { runForwardSuite } from "./runner.js";

const candidateSha = "a".repeat(40);
const hash = `sha256:${"b".repeat(64)}` as const;

describe("forward runner", () => {
  it("executes and grades every frozen scenario in disposable workspaces", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-run-"));
    const executed: string[] = [];
    const receipt = await runForwardSuite(options(out, "claude", "claude-1"), {
      adapter: fakeAdapter("claude", "claude-1", executed),
      prepareWorkspace: async ({ workspace }) => {
        await mkdir(workspace, { recursive: true });
      },
    });
    expect(receipt.status).toBe("passed");
    expect(executed).toEqual(forwardScenarioIds);
    expect(receipt.evidence).toHaveLength(8);
    for (const scenarioId of forwardScenarioIds) {
      await expect(
        readFile(join(out, "claude-1", "scenarios", scenarioId, "workspace")),
      ).rejects.toThrow();
    }
  });

  it("records native prerequisite failure as blocked-external", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-blocked-"));
    const adapter: WalkingSkeletonHostAdapter = {
      ...fakeAdapter("codex", "codex-blocked", []),
      preflight: async () => {
        throw new EvaluationError(
          "EVAL_HOST_AUTH_REQUIRED",
          "auth is external",
        );
      },
    };
    await expect(
      runForwardSuite(options(out, "codex", "codex-blocked"), { adapter }),
    ).rejects.toMatchObject({ code: "EVAL_HOST_AUTH_REQUIRED" });
    expect(
      JSON.parse(
        await readFile(join(out, "codex-blocked", "receipt.json"), "utf8"),
      ),
    ).toMatchObject({
      status: "blocked-external",
      errorCode: "EVAL_HOST_AUTH_REQUIRED",
      workspaceRetained: false,
    });
  });

  it("retains failed diagnostics only after secret and path redaction", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-redacted-"));
    const adapter = fakeAdapter("claude", "claude-redacted", []);
    const originalRun = adapter.run;
    const leakingAdapter: WalkingSkeletonHostAdapter = {
      ...adapter,
      run: async (input) => {
        const result = await originalRun(input);
        const path = join(input.cwd, ".maestro-eval", "forward-result.json");
        const raw = JSON.parse(
          await readFile(path, "utf8"),
        ) as ForwardRunEvidence;
        await writeFile(
          path,
          JSON.stringify({
            ...raw,
            toolVersions: { token: "API_TOKEN=super-secret" },
          }),
        );
        return {
          ...result,
          stdout: "Bearer super-secret /Users/alice/private/file",
        };
      },
    };
    await expect(
      runForwardSuite(options(out, "claude", "claude-redacted"), {
        adapter: leakingAdapter,
        prepareWorkspace: async ({ workspace }) => {
          await mkdir(workspace, { recursive: true });
        },
      }),
    ).rejects.toMatchObject({ code: "EVAL_ASSERTION_FAILED" });
    const receipt = await readFile(
      join(out, "claude-redacted", "receipt.json"),
      "utf8",
    );
    const firstScenario = forwardScenarioIds[0];
    if (!firstScenario) throw new Error("fixture scenario is required");
    const log = await readFile(
      join(
        out,
        "claude-redacted",
        "scenarios",
        firstScenario,
        "host.stdout.log",
      ),
      "utf8",
    );
    expect(receipt).not.toContain("super-secret");
    expect(log).not.toContain("super-secret");
    expect(log).not.toContain("/Users/alice");
  });

  it("rejects stale identity, forbidden actions, intervention excess, timing drift, and leakage", () => {
    const base = evidence("claude", "run-1", "architecture-gate-repair");
    const timing = base.timings[0];
    if (!timing) throw new Error("fixture timing is required");
    const verdict = gradeForwardEvidence({
      evidence: {
        ...base,
        candidateSha: "c".repeat(40),
        interventions: [
          { kind: "product-approval", summary: "agent recovery" },
        ],
        timings: [{ ...timing, durationMs: 2 }],
        forbiddenActions: base.forbiddenActions.map((entry) =>
          entry.id === "gate-edit" ? { ...entry, observed: true } : entry,
        ),
        toolVersions: { node: "/Users/alice/secret", auth: "TOKEN=secret" },
      },
      candidateSha,
      host: "claude",
      runId: "run-1",
      scenarioId: "architecture-gate-repair",
      initialContextSha256: base.initialContextSha256,
      userPromptSha256: base.userPromptSha256,
    });
    expect(verdict.status).toBe("failed");
    expect(verdict.failures.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "CANDIDATE_SHA_MISMATCH",
        "FORBIDDEN_ACTION_OBSERVED",
        "INTERVENTION_BUDGET_EXCEEDED",
        "TIMING_INVALID",
        "EVIDENCE_LEAKAGE",
      ]),
    );
  });
});

describe("forward aggregate", () => {
  it("accepts two equivalent passes per host", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-aggregate-"));
    for (const [host, runId] of [
      ["claude", "claude-1"],
      ["claude", "claude-2"],
      ["codex", "codex-1"],
      ["codex", "codex-2"],
    ] as const) {
      await writeReceipt(out, host, runId);
    }
    await expect(
      aggregateForwardRuns({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-1",
      }),
    ).resolves.toMatchObject({
      status: "passed",
      scenarioIds: forwardScenarioIds,
    });
  });

  it("rejects missing scenarios, mixed SHAs, and parity drift", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-diverged-"));
    await writeReceipt(out, "claude", "claude-1");
    await writeReceipt(out, "claude", "claude-2");
    await writeReceipt(out, "codex", "codex-1");
    await writeReceipt(out, "codex", "codex-2", {
      receiptSha256: `sha256:${"c".repeat(64)}`,
    });
    await expect(
      aggregateForwardRuns({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-drift",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_DIVERGED" });
  });

  it.each([
    ["missing", (receipt: ReceiptFixture) => receipt.evidence.slice(0, -1)],
    [
      "duplicate",
      (receipt: ReceiptFixture) => [
        ...receipt.evidence.slice(0, -1),
        firstEvidence(receipt),
      ],
    ],
    [
      "unknown",
      (receipt: ReceiptFixture) => [
        ...receipt.evidence.slice(0, -1),
        { ...firstEvidence(receipt), scenarioId: "invented-scenario" },
      ],
    ],
  ])("rejects %s scenario evidence", async (_kind, mutate) => {
    const out = await mkdtemp(join(tmpdir(), "forward-catalog-"));
    for (const [host, runId] of [
      ["claude", "claude-1"],
      ["claude", "claude-2"],
      ["codex", "codex-1"],
      ["codex", "codex-2"],
    ] as const) {
      await writeReceipt(out, host, runId);
    }
    const path = join(out, "codex-2", "receipt.json");
    const receipt = JSON.parse(await readFile(path, "utf8")) as ReceiptFixture;
    await writeFile(
      path,
      JSON.stringify({ ...receipt, evidence: mutate(receipt) }),
    );
    await expect(
      aggregateForwardRuns({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-invalid",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_INCOMPLETE" });
  });

  it("rejects a stale or mixed receipt SHA", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-mixed-sha-"));
    for (const [host, runId] of [
      ["claude", "claude-1"],
      ["claude", "claude-2"],
      ["codex", "codex-1"],
      ["codex", "codex-2"],
    ] as const) {
      await writeReceipt(out, host, runId);
    }
    const path = join(out, "codex-2", "receipt.json");
    const receipt = JSON.parse(await readFile(path, "utf8")) as ReceiptFixture;
    await writeFile(
      path,
      JSON.stringify({ ...receipt, candidateSha: "c".repeat(40) }),
    );
    await expect(
      aggregateForwardRuns({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-mixed",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_DIVERGED" });
  });
});

type ReceiptFixture = {
  readonly evidence: readonly Record<string, unknown>[];
  readonly [key: string]: unknown;
};

function firstEvidence(receipt: ReceiptFixture): Record<string, unknown> {
  const first = receipt.evidence[0];
  if (!first) throw new Error("fixture evidence is required");
  return first;
}

function options(out: string, host: ForwardHost, runId: string) {
  return {
    host,
    runId,
    out,
    sourceRoot: out,
    candidateSha,
    hostHome: join(out, ".host"),
  };
}

function fakeAdapter(
  host: ForwardHost,
  runId: string,
  executed: string[],
): WalkingSkeletonHostAdapter {
  return {
    host,
    preflight: async () => undefined,
    run: async ({ cwd, prompt }) => {
      const scenarioId = forwardScenarioIds.find((id) =>
        prompt.includes(`Run ${JSON.stringify(id)}`),
      );
      if (!scenarioId) throw new Error("fixture could not resolve scenario");
      executed.push(scenarioId);
      await mkdir(join(cwd, ".maestro-eval"), { recursive: true });
      await writeFile(
        join(cwd, ".maestro-eval", "forward-result.json"),
        JSON.stringify(
          evidence(host, runId, scenarioId, {
            initialContextSha256: forwardInitialContextSha256({
              candidateSha,
              host,
              scenarioId,
            }),
            userPromptSha256: sha256(prompt),
          }),
        ),
      );
      return { exitCode: 0, stdout: "ok", stderr: "", unavailable: false };
    },
  };
}

function evidence(
  host: ForwardHost,
  runId: string,
  scenarioId: ForwardScenarioId,
  hashes: {
    readonly initialContextSha256: `sha256:${string}`;
    readonly userPromptSha256: `sha256:${string}`;
  } = { initialContextSha256: hash, userPromptSha256: hash },
): ForwardRunEvidence {
  return {
    schemaVersion: 1,
    runId,
    candidateSha,
    scenarioId,
    host,
    hostVersion: "fixture-1",
    model: "fixture-model",
    toolVersions: { node: "22.0.0" },
    initialContextSha256: hashes.initialContextSha256,
    userPromptSha256: hashes.userPromptSha256,
    interventions: [],
    artifacts: [{ id: "artifact", sha256: hash }],
    commands: [
      { id: "check", exitCode: 0, resultCode: "ok", outputSha256: hash },
    ],
    timings: [
      {
        id: "total",
        startedAt: "2026-07-25T00:00:00.000Z",
        completedAt: "2026-07-25T00:00:01.000Z",
        durationMs: 1_000,
      },
    ],
    forbiddenActions: forbiddenActionIds.map((id) => ({
      id,
      observed: false,
      evidence: [],
    })),
    receiptSha256: hash,
  };
}

async function writeReceipt(
  out: string,
  host: ForwardHost,
  runId: string,
  override: Partial<ForwardRunEvidence> = {},
): Promise<void> {
  await mkdir(join(out, runId));
  await writeFile(
    join(out, runId, "receipt.json"),
    JSON.stringify({
      schemaVersion: 1,
      suite: "forward",
      host,
      runId,
      candidateSha,
      status: "passed",
      startedAt: "2026-07-25T00:00:00.000Z",
      completedAt: "2026-07-25T00:01:00.000Z",
      outputDirectory: join(out, runId),
      workspaceRetained: false,
      evidence: forwardScenarioIds.map((scenarioId) => ({
        ...evidence(host, runId, scenarioId),
        ...override,
      })),
      verdicts: [],
    }),
  );
}
