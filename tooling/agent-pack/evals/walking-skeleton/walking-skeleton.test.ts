import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { aggregateWalkingSkeletonRuns } from "./aggregate.js";
import type { WalkingSkeletonResult } from "./contract.js";
import { parseCliOptions } from "./cli.js";
import {
  createHostAdapter,
  safeHostEnvironment,
  type HostCommand,
  type WalkingSkeletonHostAdapter,
} from "./hosts.js";
import { runWalkingSkeleton } from "./runner.js";
import { verifyExecutableEvidence, type VerifierCommand } from "./verifier.js";

const candidateSha = "a".repeat(40);
const hashes = {
  manifest: `sha256:${"1".repeat(64)}`,
  gateSet: `sha256:${"2".repeat(64)}`,
  verticalSlice: `sha256:${"3".repeat(64)}`,
  firstRecord: `sha256:${"4".repeat(64)}`,
  checkExecution: `sha256:${"5".repeat(64)}`,
};

describe("walking-skeleton fail-closed harness", () => {
  it("uses a strict credential-free environment and ephemeral MCP-disabled Codex", async () => {
    const calls: HostCommand[] = [];
    const adapter = createHostAdapter("codex", async (input) => {
      calls.push(input);
      return {
        exitCode: 0,
        stdout: "authenticated",
        stderr: "",
        unavailable: false,
      };
    });
    await adapter.preflight({
      cwd: "/repo",
      hostHome: "/auth/codex",
      sessionDir: "/run/one",
    });
    await adapter.run({
      cwd: "/repo",
      hostHome: "/auth/codex",
      sessionDir: "/run/one",
      prompt: "test",
      timeoutMs: 1_000,
    });
    expect(calls[2]?.args).toEqual(
      expect.arrayContaining([
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "mcp_servers={}",
      ]),
    );
    expect(calls[2]?.env.CODEX_HOME).toBe("/auth/codex");
    expect(calls[2]?.env.CONVEX_DEPLOY_KEY).toBeUndefined();
    expect(calls[2]?.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(
      Object.keys(
        safeHostEnvironment({
          host: "codex",
          hostHome: "/auth/codex",
          sessionDir: "/run/one",
          source: { PATH: "/bin", CONVEX_DEPLOY_KEY: "secret" },
        }),
      ),
    ).not.toContain("CONVEX_DEPLOY_KEY");
  });

  it("classifies missing host executable and logged-out Claude", async () => {
    const missing = createHostAdapter("claude", async () => ({
      exitCode: null,
      stdout: "",
      stderr: "",
      unavailable: true,
    }));
    await expect(
      missing.preflight({
        cwd: "/repo",
        hostHome: "/auth",
        sessionDir: "/run",
      }),
    ).rejects.toMatchObject({ code: "EVAL_HOST_EXECUTABLE_UNAVAILABLE" });

    let call = 0;
    const loggedOut = createHostAdapter("claude", async () => ({
      exitCode: 0,
      stdout: ++call === 1 ? "1.0" : '{"loggedIn":false}',
      stderr: "",
      unavailable: false,
    }));
    await expect(
      loggedOut.preflight({
        cwd: "/repo",
        hostHome: "/auth",
        sessionDir: "/run",
      }),
    ).rejects.toMatchObject({ code: "EVAL_HOST_AUTH_REQUIRED" });
  });

  it("makes the documented focused invocation usable with safe defaults", () => {
    const parsed = parseCliOptions(
      [
        "--suite",
        "walking-skeleton",
        "--host",
        "codex",
        "--candidate-sha",
        candidateSha,
      ],
      "/repo",
      { CODEX_HOME: "/auth/codex", PATH: "/bin" },
      new Date("2026-07-25T12:00:00Z"),
    );
    expect(parsed.mode).toBe("run");
    if (parsed.mode === "run") {
      expect(parsed.options.runId).toMatch(/^codex-/u);
      expect(parsed.options.out).toBe("/repo/tooling/agent-pack/evals/runs");
      expect(parsed.options.hostHome).toBe("/auth/codex");
    }
  });

  it("rejects missing offline prerequisite evidence before trusting host claims", async () => {
    const fixture = await fixtureWorkspace();
    await expect(
      verifyExecutableEvidence({
        workspace: fixture.workspace,
        candidateSha,
        sessionDir: fixture.sessionDir,
        result: validResult(),
        ports: verifierPorts(),
      }),
    ).rejects.toMatchObject({ code: "EVAL_PREREQUISITE_EVIDENCE_MISSING" });
  });

  it("rejects empty manifest and placeholder vertical-slice evidence", async () => {
    const fixture = await fixtureWorkspace({ complete: true });
    await writeFile(
      join(fixture.workspace, "eval-target", "manifest.json"),
      "{}\n",
    );
    await expect(verify(fixture)).rejects.toMatchObject({
      code: "EVAL_MANIFEST_INVALID",
    });

    await writeValidManifest(fixture.workspace);
    await writeFile(
      join(fixture.workspace, "eval-target", "apps", "web", "records.ts"),
      "export {};\n",
    );
    await expect(verify(fixture)).rejects.toMatchObject({
      code: "EVAL_VERTICAL_SLICE_INVALID",
    });
  });

  it("rejects browser-open failure without captured proof", async () => {
    const fixture = await fixtureWorkspace({ complete: true });
    await expect(
      verifyExecutableEvidence({
        workspace: fixture.workspace,
        candidateSha,
        sessionDir: fixture.sessionDir,
        result: validResult(),
        ports: verifierPorts({ probeFails: true }),
      }),
    ).rejects.toMatchObject({ code: "EVAL_BROWSER_PROOF_UNAVAILABLE" });
  });

  it("fails closed on stale plugin or MCP configuration with recovery guidance", async () => {
    const fixture = await fixtureWorkspace({ complete: true });
    await writeFile(
      join(fixture.workspace, "eval-target", ".mcp.json"),
      "{}\n",
    );
    await expect(verify(fixture)).rejects.toMatchObject({
      code: "EVAL_FORBIDDEN_HOST_CONFIG",
      message: expect.stringContaining("removed before rerun"),
    });
  });

  it("independently verifies real evidence, writes hashes, and discards workspace", async () => {
    const out = await mkdtemp(join(tmpdir(), "maestro-eval-run-"));
    const adapter: WalkingSkeletonHostAdapter = {
      host: "codex",
      preflight: async () => undefined,
      run: async () => ({
        exitCode: 0,
        stdout: "API_TOKEN=secret-value",
        stderr: "",
        unavailable: false,
      }),
    };
    const receipt = await runWalkingSkeleton(
      {
        host: "codex",
        runId: "codex-1",
        out,
        sourceRoot: "/repo",
        candidateSha,
        hostHome: "/auth/codex",
        productName: "Acme Workspace",
      },
      {
        adapter,
        prepareWorkspace: async ({ workspace }) => {
          await populateWorkspace(workspace, true);
          await mkdir(join(workspace, ".maestro-eval"));
          await writeFile(
            join(workspace, ".maestro-eval", "walking-skeleton-result.json"),
            JSON.stringify(validResult()),
          );
        },
        verifierPorts: verifierPorts(),
        now: (() => {
          const values = [
            new Date("2026-07-25T12:00:00Z"),
            new Date("2026-07-25T12:06:00Z"),
          ];
          return () => values.shift() ?? new Date("2026-07-25T12:06:00Z");
        })(),
      },
    );
    expect(receipt.status).toBe("passed");
    expect(receipt.canonicalHashes?.manifest).toMatch(/^sha256:/u);
    await expect(access(join(out, "codex-1", "workspace"))).rejects.toThrow();
    expect(
      await readFile(join(out, "codex-1", "host.stdout.log"), "utf8"),
    ).toBe("API_TOKEN=[REDACTED]");
    expect(
      JSON.parse(
        await readFile(join(out, "codex-1", "retention.json"), "utf8"),
      ),
    ).toMatchObject({
      workspaceRetained: false,
    });
  });

  it("aggregates exactly two runs per host and rejects canonical divergence", async () => {
    const out = await mkdtemp(join(tmpdir(), "maestro-eval-suite-"));
    const runIds = ["claude-1", "claude-2", "codex-1", "codex-2"];
    for (const runId of runIds) {
      await mkdir(join(out, runId));
      await writeFile(
        join(out, runId, "receipt.json"),
        JSON.stringify({
          host: runId.startsWith("claude") ? "claude" : "codex",
          runId,
          candidateSha,
          status: "passed",
          canonicalHashes: hashes,
        }),
      );
    }
    await expect(
      aggregateWalkingSkeletonRuns({
        out,
        runIds,
        candidateSha,
        suiteRunId: "suite-pass",
      }),
    ).resolves.toMatchObject({ status: "passed", canonicalHashes: hashes });
    await writeFile(
      join(out, "codex-2", "receipt.json"),
      JSON.stringify({
        host: "codex",
        runId: "codex-2",
        candidateSha,
        status: "passed",
        canonicalHashes: { ...hashes, firstRecord: `sha256:${"9".repeat(64)}` },
      }),
    );
    await expect(
      aggregateWalkingSkeletonRuns({
        out,
        runIds,
        candidateSha,
        suiteRunId: "suite-fail",
      }),
    ).rejects.toMatchObject({ code: "EVAL_SUITE_DIVERGED" });
  });
});

function validResult(): WalkingSkeletonResult {
  const base = Date.parse("2026-07-25T12:00:00Z");
  return {
    schemaVersion: 2,
    candidateSha,
    customerTarget: "eval-target",
    milestones: [
      "prerequisites_install_complete",
      "visible_fake_url",
      "personalized_interaction",
      "first_record_persisted",
      "check_complete",
    ].map((id, index) => ({
      id,
      reachedAt: new Date(base + (index + 1) * 60_000).toISOString(),
    })),
    interventions: [{ kind: "product-naming", summary: "Named the app." }],
    evidence: {
      visibleUrl: "http://127.0.0.1:4173/records",
      manifestPath: "eval-target/manifest.json",
      receiptPath: "eval-target/receipt.json",
      recordPath: "eval-target/record.json",
      recordId: "record-1",
      verticalSlicePaths: ["eval-target/apps/web/records.ts"],
    },
    explanation: {
      works: "Record create and read work locally.",
      demoOnly: "Storage remains fake.",
      nextAction: "Connect personal Convex dev when ready.",
    },
  };
}

async function fixtureWorkspace(
  options: { prerequisites?: boolean; complete?: boolean } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "maestro-eval-fixture-"));
  const workspace = join(root, "workspace");
  const sessionDir = join(root, "session");
  await mkdir(workspace);
  await mkdir(sessionDir);
  await mkdir(join(workspace, "eval-target", "apps", "web"), {
    recursive: true,
  });
  if (options.prerequisites || options.complete)
    await writePrerequisites(workspace);
  if (options.complete) await populateWorkspace(workspace, false);
  return { workspace, sessionDir };
}

async function populateWorkspace(
  workspace: string,
  includePrerequisites: boolean,
) {
  await mkdir(join(workspace, "eval-target", "apps", "web"), {
    recursive: true,
  });
  if (includePrerequisites) await writePrerequisites(workspace);
  await writeValidManifest(workspace);
  await writeFile(
    join(workspace, "eval-target", "receipt.json"),
    JSON.stringify(validReceipt()),
  );
  await writeFile(
    join(workspace, "eval-target", "record.json"),
    JSON.stringify({
      id: "record-1",
      title: "Customer record",
      detail: "Persisted locally",
      synthetic: false,
    }),
  );
  await writeFile(
    join(workspace, "eval-target", "apps", "web", "records.ts"),
    "export type RecordItem = { id: string; title: string };\nexport const createRecord = (title: string): RecordItem => ({ id: `record-${title.length}`, title });\n",
  );
}

async function writePrerequisites(workspace: string) {
  await mkdir(join(workspace, "node_modules"), { recursive: true });
  await writeFile(
    join(workspace, "pnpm-lock.yaml"),
    `lockfileVersion: '9.0'\n${"# frozen\n".repeat(8)}`,
  );
  await writeFile(
    join(workspace, "node_modules", ".modules.yaml"),
    `${"virtualStoreDir: .pnpm\n".repeat(3)}`,
  );
}

async function writeValidManifest(workspace: string) {
  await writeFile(
    join(workspace, "eval-target", "manifest.json"),
    JSON.stringify({
      $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
      schemaVersion: 1,
      materializationStatus: "materializable",
      release: {
        version: "0.2.0-alpha.1",
        tag: "maestro-template-v0.2.0-alpha.1",
        sourceCommit: candidateSha,
        sourceChecksum: `sha256:${"a".repeat(64)}`,
      },
      compatibility: { cli: "1", agentPack: "1" },
      paths: [
        {
          path: "apps/web",
          match: "subtree",
          ownership: "template-owned",
          action: "copy",
          upgrade: "replace",
        },
      ],
      expectedHashes: { "apps/web/records.ts": `sha256:${"b".repeat(64)}` },
      extensionSeams: [],
    }),
  );
}

function validReceipt() {
  return {
    schemaVersion: 1,
    createdAt: "2026-07-25T12:05:00Z",
    command: { id: "check", version: 1 },
    subject: { commit: candidateSha, dirty: true },
    fingerprints: {
      repository: "repository_sha256:abc",
      environment: "environment_sha256:def",
      providerPosture: "providers_sha256:ghi",
    },
    scope: { kind: "full", changedPaths: [], partial: false },
    gates: [
      {
        gateId: "architecture",
        posture: "required",
        evidenceClass: "behavioral",
        status: "pass",
        semanticRuleIds: [],
      },
    ],
  };
}

function verifierPorts(options: { probeFails?: boolean } = {}) {
  const command: VerifierCommand = async (input) => {
    if (input.command === "git" && input.args[0] === "rev-parse") {
      return { exitCode: 0, stdout: `${candidateSha}\n`, stderr: "" };
    }
    if (input.command === "git") return { exitCode: 0, stdout: "", stderr: "" };
    return { exitCode: 0, stdout: '{"status":"pass"}', stderr: "" };
  };
  return {
    command,
    probeUrl: options.probeFails
      ? async () => {
          throw new Error("browser unavailable");
        }
      : async () => ({
          statusCode: 200,
          body: "<html>records record-1</html>",
        }),
  };
}

async function verify(fixture: { workspace: string; sessionDir: string }) {
  return verifyExecutableEvidence({
    workspace: fixture.workspace,
    candidateSha,
    sessionDir: fixture.sessionDir,
    result: validResult(),
    ports: verifierPorts(),
  });
}
