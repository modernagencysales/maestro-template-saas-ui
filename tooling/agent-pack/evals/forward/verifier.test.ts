import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { forbiddenActionIds } from "../assertions/forbiddenActions.js";
import type { ForwardRunEvidence } from "../scenarios/evidence.js";
import { forwardScenarios } from "../scenarios/forward.js";
import { buildForwardPrompt, sha256 } from "./contract.js";
import {
  forwardCommandAttestationSha256,
  forwardReceiptSha256,
  forwardScenarioContracts,
  type ForwardVerifierPorts,
  verifyForwardScenario,
} from "./verifier.js";

const candidateSha = "a".repeat(40);
const commandResult = { exitCode: 0, stdout: "ok", stderr: "" };

describe("greenfield tagged customer artifact verification", () => {
  it("tells the host to bind artifact evidence to the separate customer instance", () => {
    const prompt = buildForwardPrompt({
      candidateSha,
      host: "codex",
      runId: "fixture-run",
      scenarioId: "greenfield-tagged-customer",
      resultPath: ".maestro-eval/forward-result.json",
      artifactId: "materialization-receipt",
      command: forwardScenarioContracts["greenfield-tagged-customer"].command,
    });

    expect(prompt).toContain(
      "exactly one direct-child customer target template-instance.json",
    );
    expect(prompt).toContain("reviewed release and ownership binding");
    expect(prompt).toContain(
      "node tooling/agent-pack/evals/forward/gate-launcher.mjs check:gates",
    );
    expect(prompt).toContain("without substituting pnpm, tsx");
  });

  it("executes the same committed launcher printed in the blind prompt", async () => {
    const fixture = await greenfieldFixture();
    let executed:
      | {
          readonly command: string;
          readonly args: readonly string[];
        }
      | undefined;

    await verify(fixture, async (input) => {
      executed = input;
      return commandResult;
    });

    const frozen =
      forwardScenarioContracts["greenfield-tagged-customer"].command;
    expect(executed).toMatchObject({
      command: frozen.executable,
      args: frozen.args,
    });
  });

  it("accepts a separate manifest-bound customer target with factory-only omissions", async () => {
    const fixture = await greenfieldFixture();

    await expect(verify(fixture)).resolves.toMatchObject({ failures: [] });
  });

  it.each([
    [
      "workspace-root target",
      async (fixture: Awaited<ReturnType<typeof greenfieldFixture>>) => {
        await fixture.rewriteArtifact("template-instance.json");
      },
    ],
    [
      "release binding drift",
      async (fixture: Awaited<ReturnType<typeof greenfieldFixture>>) => {
        await fixture.rewriteInstance({
          release: {
            ...fixture.release,
            tag: "maestro-template-v0.2.0-alpha.1-moved",
          },
        });
      },
    ],
    [
      "missing ownership checksum",
      async (fixture: Awaited<ReturnType<typeof greenfieldFixture>>) => {
        await fixture.rewriteInstance({
          ownership: { manifest: fixture.manifestPath },
        });
      },
    ],
    [
      "factory-only output",
      async (fixture: Awaited<ReturnType<typeof greenfieldFixture>>) => {
        const path = join(
          fixture.workspace,
          fixture.target,
          ".agents/private.ts",
        );
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, "forbidden\n");
      },
    ],
    [
      "reviewed ownership manifest drift",
      async (fixture: Awaited<ReturnType<typeof greenfieldFixture>>) => {
        await writeFile(
          join(fixture.workspace, fixture.manifestPath),
          '{"forged":true}\n',
        );
      },
    ],
  ])("rejects %s", async (_label, mutate) => {
    const fixture = await greenfieldFixture();
    await mutate(fixture);

    const result = await verify(fixture);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ARTIFACT_INVALID" }),
      ]),
    );
  });
});

async function greenfieldFixture() {
  const workspace = await mkdtemp(join(tmpdir(), "forward-artifact-"));
  const target = "customer-app";
  const manifestPath = "releases/v0.2.0-alpha.1/manifest.json";
  const baseManifestPath = "releases/v0.1.0-alpha.1/manifest.json";
  const repositoryRoot = join(import.meta.dirname, "../../../..");
  const [baseBytes, manifestBytes] = await Promise.all([
    readFile(join(repositoryRoot, baseManifestPath), "utf8"),
    readFile(join(repositoryRoot, manifestPath), "utf8"),
  ]);
  const manifest = JSON.parse(manifestBytes) as {
    readonly release: Record<string, unknown>;
  };
  const release = manifest.release;
  const instancePath = `${target}/template-instance.json`;
  let instance: Record<string, unknown> = {
    schemaVersion: 1,
    release,
    ownership: {
      manifest: manifestPath,
      manifestChecksum: sha256(manifestBytes),
      extensionSeams: [],
    },
  };
  await mkdir(join(workspace, dirname(baseManifestPath)), { recursive: true });
  await writeFile(join(workspace, baseManifestPath), baseBytes);
  await mkdir(join(workspace, dirname(manifestPath)), { recursive: true });
  await writeFile(join(workspace, manifestPath), manifestBytes);
  await mkdir(join(workspace, target), { recursive: true });

  let artifactPath = instancePath;
  const writeInstance = async () => {
    await writeFile(
      join(workspace, instancePath),
      `${JSON.stringify(instance)}\n`,
    );
  };
  await writeInstance();

  return {
    workspace,
    target,
    manifestPath,
    release,
    get artifactPath() {
      return artifactPath;
    },
    rewriteArtifact: async (path: string) => {
      artifactPath = path;
      if (path === "template-instance.json") {
        await writeFile(join(workspace, path), `${JSON.stringify(instance)}\n`);
      }
    },
    rewriteInstance: async (patch: Record<string, unknown>) => {
      instance = { ...instance, ...patch };
      await writeInstance();
    },
  };
}

async function verify(
  fixture: Awaited<ReturnType<typeof greenfieldFixture>>,
  execute: ForwardVerifierPorts["execute"] = async () => commandResult,
) {
  const scenarioId = "greenfield-tagged-customer" as const;
  const contract = forwardScenarioContracts[scenarioId];
  const instanceBytes = await readFile(
    join(fixture.workspace, fixture.artifactPath),
  );
  const artifact = `${JSON.stringify({
    schemaVersion: 1,
    scenarioId,
    candidateSha,
    outcome: forwardScenarios.find(({ id }) => id === scenarioId)?.outcome,
    files: [{ path: fixture.artifactPath, sha256: sha256(instanceBytes) }],
  })}\n`;
  const artifactPath = join(
    fixture.workspace,
    ".maestro-eval/artifacts/materialization-receipt.json",
  );
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, artifact);
  const unsigned = {
    schemaVersion: 1,
    runId: "fixture-run",
    candidateSha,
    scenarioId,
    host: "codex",
    hostVersion: "fixture",
    model: "fixture",
    toolVersions: { node: "22" },
    initialContextSha256: sha256("context"),
    userPromptSha256: sha256("prompt"),
    interventions: [],
    artifacts: [{ id: contract.artifactId, sha256: sha256(artifact) }],
    commands: [
      {
        id: contract.command.id,
        exitCode: 0,
        resultCode: "passed",
        attestationSha256: forwardCommandAttestationSha256({
          candidateSha,
          scenarioId,
          command: contract.command,
          exitCode: 0,
        }),
      },
    ],
    timings: [
      {
        id: "total",
        startedAt: "2026-07-26T00:00:00.000Z",
        completedAt: "2026-07-26T00:00:01.000Z",
        durationMs: 1_000,
      },
    ],
    forbiddenActions: forbiddenActionIds.map((id) => ({
      id,
      observed: false,
      evidence: [],
    })),
  } as const;
  const evidence: ForwardRunEvidence = {
    ...unsigned,
    receiptSha256: forwardReceiptSha256(unsigned),
  };
  return verifyForwardScenario({
    workspace: fixture.workspace,
    sessionDir: fixture.workspace,
    candidateSha,
    scenarioId,
    evidence,
    ports: { execute },
  });
}
