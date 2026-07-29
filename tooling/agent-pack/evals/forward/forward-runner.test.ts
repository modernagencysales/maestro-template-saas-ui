import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { forbiddenActionIds } from "../assertions/forbiddenActions.js";
import type { ForwardHost, ForwardRunEvidence } from "../scenarios/evidence.js";
import {
  forwardScenarios,
  forwardScenarioIds,
  type ForwardScenarioId,
} from "../scenarios/forward.js";
import { EvaluationError } from "../walking-skeleton/contract.js";
import type { WalkingSkeletonHostAdapter } from "../walking-skeleton/hosts.js";
import { aggregateForwardRuns } from "./aggregate.js";
import {
  buildForwardPrompt,
  forwardInitialContextSha256,
  gradeForwardEvidence,
  sha256,
} from "./contract.js";
import { runForwardSuite } from "./runner.js";
import {
  forwardCommandAttestationSha256,
  forwardReceiptSha256,
  forwardScenarioContracts,
} from "./verifier.js";

const candidateSha = "a".repeat(40);
const hash = `sha256:${"b".repeat(64)}` as const;

describe("forward runner", () => {
  it("binds command proof to semantics instead of nondeterministic output", () => {
    const contract = forwardScenarioContracts["architecture-gate-repair"];
    const base = {
      candidateSha,
      scenarioId: "architecture-gate-repair" as const,
      command: contract.command,
      exitCode: 0,
    };
    expect(forwardCommandAttestationSha256(base)).toBe(
      forwardCommandAttestationSha256({
        ...base,
        diagnostics: {
          stdout: "> package /different/disposable/root 99ms",
          stderr: "TOKEN=redacted",
        },
      }),
    );
    const baseHash = forwardCommandAttestationSha256(base);
    const mutations = [
      forwardCommandAttestationSha256({
        ...base,
        candidateSha: "c".repeat(40),
      }),
      forwardCommandAttestationSha256({
        ...base,
        scenarioId: "prototype-adoption",
      }),
      forwardCommandAttestationSha256({
        ...base,
        command: { ...contract.command, args: ["invented-gate"] },
      }),
      forwardCommandAttestationSha256({ ...base, exitCode: 1 }),
    ];
    expect(mutations).toHaveLength(4);
    expect(mutations.every((value) => value !== baseHash)).toBe(true);
    expect(new Set(mutations).size).toBe(mutations.length);
  });

  it("executes and grades every frozen scenario in disposable workspaces", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-run-"));
    const executed: string[] = [];
    const lifecycle: string[] = [];
    const adapter = fakeAdapter("claude", "claude-1", executed);
    const originalRun = adapter.run;
    const receipt = await runForwardSuite(options(out, "claude", "claude-1"), {
      adapter: {
        ...adapter,
        run: async (input) => {
          const scenarioId = scenarioFromPrompt(input.prompt);
          lifecycle.push(`run:${scenarioId}`);
          return originalRun(input);
        },
      },
      prepareWorkspace: async ({ workspace }) => {
        await mkdir(workspace, { recursive: true });
      },
      provisionReleaseTag: async (input) => {
        lifecycle.push(`provision:${input.scenarioId}`);
        return fixtureReleaseTag();
      },
      assertReleaseTag: async (input) => {
        lifecycle.push(`assert:${input.scenarioId}`);
      },
      verifierPorts: fixtureVerifierPorts,
    });
    expect(receipt.status).toBe("passed");
    expect(executed).toEqual(forwardScenarioIds);
    expect(lifecycle).toEqual(
      forwardScenarioIds.flatMap((scenarioId) => [
        `provision:${scenarioId}`,
        `run:${scenarioId}`,
        `assert:${scenarioId}`,
      ]),
    );
    expect(receipt.evidence).toHaveLength(8);
    for (const scenarioId of forwardScenarioIds) {
      await expect(
        readFile(join(out, "claude-1", "scenarios", scenarioId, "workspace")),
      ).rejects.toThrow();
    }
  });

  it("keeps verifier temp sockets below the Unix path limit for long outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "forward-long-out-"));
    const out = join(root, "x".repeat(80), "y".repeat(80));
    await mkdir(out, { recursive: true });
    const sessionDirs: string[] = [];
    const adapter = fakeAdapter("codex", "codex-short-session", []);
    const originalRun = adapter.run;

    await runForwardSuite(options(out, "codex", "codex-short-session"), {
      adapter: {
        ...adapter,
        run: async (input) => {
          sessionDirs.push(input.sessionDir);
          return originalRun(input);
        },
      },
      prepareWorkspace: async ({ workspace }) => {
        await mkdir(workspace, { recursive: true });
      },
      provisionReleaseTag: fixtureReleaseTag,
      assertReleaseTag: fixtureAssertReleaseTag,
      verifierPorts: fixtureVerifierPorts,
    });

    expect(new Set(sessionDirs).size).toBe(1);
    const sessionDir = sessionDirs[0];
    if (!sessionDir) throw new Error("fixture session directory is required");
    expect(
      join(sessionDir, "tsx-1000", "1234567.pipe").length,
    ).toBeLessThanOrEqual(107);
    expect(sessionDir.startsWith(out)).toBe(false);
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
    ).resolves.toMatchObject({
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
            toolVersions: {
              node: "/Users/alice/private/node",
              token: "API_TOKEN=super-secret",
            },
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
        provisionReleaseTag: fixtureReleaseTag,
        assertReleaseTag: fixtureAssertReleaseTag,
        verifierPorts: fixtureVerifierPorts,
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
    expect(receipt).not.toContain("/Users/alice");
    expect(log).not.toContain("super-secret");
    expect(log).not.toContain("/Users/alice");
  });

  it("rejects fabricated artifact and command receipts", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-fabricated-"));
    const base = fakeAdapter("codex", "codex-fabricated", []);
    const originalRun = base.run;
    const adapter: WalkingSkeletonHostAdapter = {
      ...base,
      run: async (input) => {
        const result = await originalRun(input);
        const path = join(input.cwd, ".maestro-eval", "forward-result.json");
        const raw = JSON.parse(
          await readFile(path, "utf8"),
        ) as ForwardRunEvidence;
        const fabricated = {
          ...raw,
          artifacts: raw.artifacts.map((entry) => ({ ...entry, sha256: hash })),
          commands: raw.commands.map((entry) => ({
            ...entry,
            attestationSha256: hash,
          })),
        };
        await writeFile(
          path,
          JSON.stringify({
            ...fabricated,
            receiptSha256: forwardReceiptSha256(fabricated),
          }),
        );
        return result;
      },
    };
    await expect(
      runForwardSuite(options(out, "codex", "codex-fabricated"), {
        adapter,
        prepareWorkspace: async ({ workspace }) => {
          await mkdir(workspace, { recursive: true });
        },
        provisionReleaseTag: fixtureReleaseTag,
        assertReleaseTag: fixtureAssertReleaseTag,
        verifierPorts: {
          execute: async () => ({
            exitCode: 0,
            stdout: "Bearer super-secret /Users/alice/private/result",
            stderr: "API_TOKEN=super-secret",
          }),
        },
      }),
    ).rejects.toMatchObject({ code: "EVAL_ASSERTION_FAILED" });
    const firstScenario = forwardScenarioIds[0];
    if (!firstScenario) throw new Error("fixture scenario is required");
    const verdict = JSON.parse(
      await readFile(
        join(
          out,
          "codex-fabricated",
          "scenarios",
          firstScenario,
          "verdict.json",
        ),
        "utf8",
      ),
    ) as { failures: readonly { code: string }[] };
    expect(verdict.failures.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "ARTIFACT_HASH_MISMATCH",
        "COMMAND_RECEIPT_MISMATCH",
      ]),
    );
    const commandResult = await readFile(
      join(
        out,
        "codex-fabricated",
        "scenarios",
        firstScenario,
        "command-result.json",
      ),
      "utf8",
    );
    expect(commandResult).not.toContain("super-secret");
    expect(commandResult).not.toContain("/Users/alice");
    expect(commandResult).toContain("[REDACTED");
  });

  it("returns blocked-external when host isolation is unverified", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-isolation-"));
    const adapter = {
      ...fakeAdapter("claude", "claude-unverified", []),
      isolation: "unverified" as const,
    };
    await expect(
      runForwardSuite(options(out, "claude", "claude-unverified"), {
        adapter,
      }),
    ).resolves.toMatchObject({
      status: "blocked-external",
      errorCode: "EVAL_HOST_ISOLATION_UNAVAILABLE",
    });
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
      verifierFailures: [],
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
    await runAggregateFixtures(out);
    await expect(
      aggregateForwardFixture({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-1",
      }),
    ).resolves.toMatchObject({
      status: "passed",
      scenarioIds: forwardScenarioIds,
    });
  }, 15_000);

  it("accepts different redacted diagnostics when command semantics match", async () => {
    const root = await mkdtemp(join(tmpdir(), "forward-diagnostics-"));
    const out = join(root, "x".repeat(80), "y".repeat(80));
    await mkdir(out, { recursive: true });
    await runAggregateFixtures(out);
    let execution = 0;
    const tempDirs: string[] = [];
    await expect(
      aggregateForwardRuns(
        {
          out,
          sourceRoot: out,
          runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
          candidateSha,
          suiteRunId: "suite-diagnostics",
        },
        {
          prepareWorkspace: fixtureAggregatePorts.prepareWorkspace,
          verifierPorts: {
            execute: async (input) => {
              const tempDir = input.env.TMPDIR;
              if (tempDir) tempDirs.push(tempDir);
              return {
                exitCode: 0,
                stdout: `> package /disposable/root-${String(execution++)} ${String(Date.now())}ms`,
                stderr: "TOKEN=redacted",
              };
            },
          },
        },
      ),
    ).resolves.toMatchObject({ status: "passed" });
    expect(tempDirs.length).toBeGreaterThan(0);
    expect(
      tempDirs.every(
        (tempDir) =>
          join(tempDir, "tsx-1000", "1234567.pipe").length <= 107 &&
          !tempDir.startsWith(out),
      ),
    ).toBe(true);
  });

  it("rejects an independent semantic command failure", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-command-failed-"));
    await runAggregateFixtures(out);
    await expect(
      aggregateForwardRuns(
        {
          out,
          sourceRoot: out,
          runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
          candidateSha,
          suiteRunId: "suite-command-failed",
        },
        {
          prepareWorkspace: fixtureAggregatePorts.prepareWorkspace,
          verifierPorts: {
            execute: async () => ({
              exitCode: 1,
              stdout: "",
              stderr: "semantic gate failed",
            }),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_DIVERGED" });
  });

  it("rejects missing scenarios, mixed SHAs, and parity drift", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-diverged-"));
    await runAggregateFixtures(out);
    const driftPath = join(out, "codex-2", "receipt.json");
    const driftReceipt = JSON.parse(
      await readFile(driftPath, "utf8"),
    ) as ReceiptFixture;
    const driftEvidence = driftReceipt.evidence.map((entry, index) =>
      index === 0
        ? { ...entry, receiptSha256: `sha256:${"c".repeat(64)}` }
        : entry,
    );
    await writeFile(
      driftPath,
      JSON.stringify({ ...driftReceipt, evidence: driftEvidence }),
    );
    await expect(
      aggregateForwardFixture({
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
    await runAggregateFixtures(out);
    const path = join(out, "codex-2", "receipt.json");
    const receipt = JSON.parse(await readFile(path, "utf8")) as ReceiptFixture;
    await writeFile(
      path,
      JSON.stringify({ ...receipt, evidence: mutate(receipt) }),
    );
    await expect(
      aggregateForwardFixture({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-invalid",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_INCOMPLETE" });
  });

  it("rejects a stale or mixed receipt SHA", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-mixed-sha-"));
    await runAggregateFixtures(out);
    const path = join(out, "codex-2", "receipt.json");
    const receipt = JSON.parse(await readFile(path, "utf8")) as ReceiptFixture;
    await writeFile(
      path,
      JSON.stringify({ ...receipt, candidateSha: "c".repeat(40) }),
    );
    await expect(
      aggregateForwardFixture({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-mixed",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_DIVERGED" });
  });

  it("rejects a receipt copied into a different requested run directory", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-copied-run-"));
    await runAggregateFixtures(out);
    const path = join(out, "codex-2", "receipt.json");
    const receipt = JSON.parse(await readFile(path, "utf8")) as ReceiptFixture;
    await writeFile(
      path,
      JSON.stringify({ ...receipt, runId: "codex-copied" }),
    );
    await expect(
      aggregateForwardFixture({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-copied",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_INCOMPLETE" });
  });

  it.each(["artifact", "referenced-file", "command-result"] as const)(
    "rejects recomputed %s forgery against retained verifier inputs",
    async (kind) => {
      const out = await mkdtemp(join(tmpdir(), "forward-forged-input-"));
      await runAggregateFixtures(out);
      await forgeRetainedInput(out, kind);
      await expect(
        aggregateForwardFixture({
          out,
          runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
          candidateSha,
          suiteRunId: `suite-forged-${kind}`,
        }),
      ).rejects.toMatchObject({ code: "EVAL_SUITE_DIVERGED" });
    },
  );

  it("rejects coordinated command-result forgery in every run", async () => {
    const out = await mkdtemp(join(tmpdir(), "forward-forged-command-all-"));
    await runAggregateFixtures(out);
    for (const runId of ["claude-1", "claude-2", "codex-1", "codex-2"]) {
      await forgeRetainedInput(out, "command-result", runId);
    }
    await expect(
      aggregateForwardFixture({
        out,
        runIds: ["claude-1", "claude-2", "codex-1", "codex-2"],
        candidateSha,
        suiteRunId: "suite-forged-command-all",
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
    isolation: "workspace-offline",
    preflight: async () => undefined,
    run: async ({ cwd, prompt, networkAccess }) => {
      if (networkAccess !== false)
        throw new Error("forward fixture requires offline transport");
      const scenarioId = forwardScenarioIds.find((id) =>
        prompt.includes(`Run ${JSON.stringify(id)}`),
      );
      if (!scenarioId) throw new Error("fixture could not resolve scenario");
      executed.push(scenarioId);
      const files =
        scenarioId === "greenfield-tagged-customer"
          ? await writeGreenfieldArtifactFixture(cwd)
          : await writeGenericArtifactFixture(cwd, scenarioId);
      const contract = forwardScenarioContracts[scenarioId];
      const artifact = JSON.stringify({
        schemaVersion: 1,
        scenarioId,
        candidateSha,
        outcome: forwardScenarios.find(({ id }) => id === scenarioId)?.outcome,
        files,
      });
      await mkdir(join(cwd, ".maestro-eval", "artifacts"), {
        recursive: true,
      });
      await writeFile(
        join(cwd, ".maestro-eval", "artifacts", `${contract.artifactId}.json`),
        artifact,
      );
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
            artifactSha256: sha256(artifact),
          }),
        ),
      );
      return { exitCode: 0, stdout: "ok", stderr: "", unavailable: false };
    },
  };
}

async function writeGenericArtifactFixture(
  cwd: string,
  scenarioId: ForwardScenarioId,
) {
  const path = `fixture-${scenarioId}.json`;
  const bytes = `${JSON.stringify({ scenarioId, verified: true })}\n`;
  await writeFile(join(cwd, path), bytes);
  return [{ path, sha256: sha256(bytes) }];
}

async function writeGreenfieldArtifactFixture(cwd: string) {
  const manifestPath = "releases/v0.2.0-alpha.1/manifest.json";
  const baseManifestPath = "releases/v0.1.0-alpha.1/manifest.json";
  const repositoryRoot = join(import.meta.dirname, "../../../..");
  const [manifestBytes, baseManifestBytes] = await Promise.all([
    readFile(join(repositoryRoot, manifestPath), "utf8"),
    readFile(join(repositoryRoot, baseManifestPath), "utf8"),
  ]);
  const manifest = JSON.parse(manifestBytes) as {
    readonly release: Readonly<Record<string, unknown>>;
  };
  const instancePath = "customer-app/template-instance.json";
  const instanceBytes = `${JSON.stringify({
    schemaVersion: 1,
    release: manifest.release,
    ownership: {
      manifest: manifestPath,
      manifestChecksum: sha256(manifestBytes),
      extensionSeams: [],
    },
  })}\n`;
  for (const [path, bytes] of [
    [manifestPath, manifestBytes],
    [baseManifestPath, baseManifestBytes],
    [instancePath, instanceBytes],
  ] as const) {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), bytes);
  }
  return [
    { path: instancePath, sha256: sha256(instanceBytes) },
    { path: manifestPath, sha256: sha256(manifestBytes) },
    { path: baseManifestPath, sha256: sha256(baseManifestBytes) },
  ];
}

function evidence(
  host: ForwardHost,
  runId: string,
  scenarioId: ForwardScenarioId,
  hashes: {
    readonly initialContextSha256: `sha256:${string}`;
    readonly userPromptSha256: `sha256:${string}`;
    readonly artifactSha256?: `sha256:${string}`;
  } = fixtureHashes(host, runId, scenarioId),
): ForwardRunEvidence {
  const contract = forwardScenarioContracts[scenarioId];
  const unsigned = {
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
    artifacts: [
      { id: contract.artifactId, sha256: hashes.artifactSha256 ?? hash },
    ],
    commands: [
      {
        id: contract.command.id,
        exitCode: 0,
        resultCode: "passed",
        attestationSha256: forwardCommandAttestationSha256({
          candidateSha,
          scenarioId,
          command: contract.command,
          exitCode: fixtureCommandResult.exitCode,
        }),
      },
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
  } as const;
  return {
    ...unsigned,
    receiptSha256: forwardReceiptSha256(unsigned),
  };
}

async function runAggregateFixtures(out: string): Promise<void> {
  for (const [host, runId] of [
    ["claude", "claude-1"],
    ["claude", "claude-2"],
    ["codex", "codex-1"],
    ["codex", "codex-2"],
  ] as const) {
    await runForwardSuite(options(out, host, runId), {
      adapter: fakeAdapter(host, runId, []),
      prepareWorkspace: async ({ workspace }) => {
        await mkdir(workspace, { recursive: true });
      },
      provisionReleaseTag: fixtureReleaseTag,
      assertReleaseTag: fixtureAssertReleaseTag,
      verifierPorts: fixtureVerifierPorts,
    });
  }
}

function aggregateForwardFixture(
  input: Omit<Parameters<typeof aggregateForwardRuns>[0], "sourceRoot">,
) {
  return aggregateForwardRuns(
    { ...input, sourceRoot: input.out },
    fixtureAggregatePorts,
  );
}

async function forgeRetainedInput(
  out: string,
  kind: "artifact" | "referenced-file" | "command-result",
  runId = "codex-2",
): Promise<void> {
  const scenarioId = forwardScenarioIds[0];
  if (!scenarioId) throw new Error("fixture scenario is required");
  const scenarioRoot = join(out, runId, "scenarios", scenarioId);
  const retainedRoot = join(scenarioRoot, "retained-verifier-inputs");
  const artifactPath = join(
    retainedRoot,
    ".maestro-eval",
    "artifacts",
    `${forwardScenarioContracts[scenarioId].artifactId}.json`,
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
    schemaVersion: 1;
    scenarioId: ForwardScenarioId;
    candidateSha: string;
    outcome: string;
    files: { path: string; sha256: `sha256:${string}` }[];
    forged?: boolean;
  };
  if (kind === "artifact") artifact.forged = true;
  if (kind === "referenced-file") {
    const file = artifact.files[0];
    if (!file) throw new Error("fixture referenced file is required");
    const bytes = "forged product bytes\n";
    await writeFile(join(retainedRoot, file.path), bytes);
    file.sha256 = sha256(bytes);
  }
  await writeFile(artifactPath, JSON.stringify(artifact));
  const commandPath = join(scenarioRoot, "command-result.json");
  const command = JSON.parse(await readFile(commandPath, "utf8")) as {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
  if (kind === "command-result") {
    command.exitCode = 1;
    await writeFile(commandPath, JSON.stringify(command));
  }
  const receiptPath = join(out, runId, "receipt.json");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as {
    host: ForwardHost;
    evidence: ForwardRunEvidence[];
    verdicts: ReturnType<typeof gradeForwardEvidence>[];
  };
  const evidence = receipt.evidence.map((entry) => {
    if (entry.scenarioId !== scenarioId) return entry;
    const changed = {
      ...entry,
      artifacts: [
        {
          id: forwardScenarioContracts[scenarioId].artifactId,
          sha256: sha256(JSON.stringify(artifact)),
        },
      ],
      commands:
        kind === "command-result"
          ? entry.commands.map((value) => ({
              ...value,
              attestationSha256: forwardCommandAttestationSha256({
                candidateSha,
                scenarioId,
                command: forwardScenarioContracts[scenarioId].command,
                exitCode: command.exitCode,
              }),
            }))
          : entry.commands,
    };
    return { ...changed, receiptSha256: forwardReceiptSha256(changed) };
  });
  const changedEvidence = evidence.find(
    (entry) => entry.scenarioId === scenarioId,
  );
  if (!changedEvidence) throw new Error("fixture evidence is required");
  const contract = forwardScenarioContracts[scenarioId];
  const prompt = buildForwardPrompt({
    candidateSha,
    host: receipt.host,
    runId,
    scenarioId,
    resultPath: ".maestro-eval/forward-result.json",
    artifactId: contract.artifactId,
    command: contract.command,
  });
  const forgedVerdict = gradeForwardEvidence({
    evidence: changedEvidence,
    candidateSha,
    host: receipt.host,
    runId,
    scenarioId,
    initialContextSha256: forwardInitialContextSha256({
      candidateSha,
      host: receipt.host,
      scenarioId,
    }),
    userPromptSha256: sha256(prompt),
    verifierFailures: [],
  });
  const verdicts = receipt.verdicts.map((entry) =>
    entry.scenarioId === scenarioId ? forgedVerdict : entry,
  );
  await writeFile(
    receiptPath,
    JSON.stringify({ ...receipt, evidence, verdicts }),
  );
}

const fixtureCommandResult = { exitCode: 0, stdout: "verified", stderr: "" };
const fixtureReleaseTag = async () => ({ status: "not-required" as const });
const fixtureAssertReleaseTag = async () => undefined;
const fixtureVerifierPorts = {
  execute: async () => fixtureCommandResult,
};
const fixtureAggregatePorts = {
  prepareWorkspace: async ({ workspace }: { readonly workspace: string }) => {
    await mkdir(workspace, { recursive: true });
  },
  verifierPorts: fixtureVerifierPorts,
};

function scenarioFromPrompt(prompt: string): ForwardScenarioId {
  const scenarioId = forwardScenarioIds.find((id) =>
    prompt.includes(`Run ${JSON.stringify(id)}`),
  );
  if (!scenarioId) throw new Error("fixture could not resolve scenario");
  return scenarioId;
}

function fixtureHashes(
  host: ForwardHost,
  runId: string,
  scenarioId: ForwardScenarioId,
): {
  readonly initialContextSha256: `sha256:${string}`;
  readonly userPromptSha256: `sha256:${string}`;
  readonly artifactSha256: `sha256:${string}`;
} {
  const contract = forwardScenarioContracts[scenarioId];
  const prompt = buildForwardPrompt({
    candidateSha,
    host,
    runId,
    scenarioId,
    resultPath: ".maestro-eval/forward-result.json",
    artifactId: contract.artifactId,
    command: contract.command,
  });
  return {
    initialContextSha256: forwardInitialContextSha256({
      candidateSha,
      host,
      scenarioId,
    }),
    userPromptSha256: sha256(prompt),
    artifactSha256: sha256(aggregateArtifact(scenarioId)),
  };
}

function aggregateArtifact(scenarioId: ForwardScenarioId): string {
  return `${JSON.stringify({ scenarioId, retained: true })}\n`;
}
