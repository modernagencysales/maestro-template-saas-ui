import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runCrudProof } from "../../../generators/src/crud-proof.js";
import { aggregateWalkingSkeletonRuns } from "./aggregate.js";
import { parseCliOptions } from "./cli.js";
import type { WalkingSkeletonResult } from "./contract.js";
import {
  claudeSandboxSettings,
  createHostAdapter,
  executeHostCommand,
  safeHostEnvironment,
  type HostCommand,
} from "./hosts.js";
import {
  createNativeBrowserOpenPort,
  createTrustedCandidateProjectionBuilder,
  verifyExecutableEvidence,
  type BrowserOpenPort,
  type CandidateProjectionBuilder,
  type ProductProofRunner,
  type VerifierCommand,
} from "./verifier.js";

const candidateSha = "a".repeat(40);
const reviewedCommit = "1".repeat(40);
const reviewedClaudeSettings = `${JSON.stringify(
  { enableAllProjectMcpServers: false },
  null,
  2,
)}\n`;
const projectedContent =
  "export type RecordItem = { id: string; title: string };\nexport const recordsRoute = '/records';\n";
const fixtureProjection: CandidateProjectionBuilder = () => ({
  id: "saas-application",
  provenance: "@maestro-template/generators/saas-application@1",
  digest: sha("target plan"),
  entries: [
    { path: ".claude/settings.json", sha256: sha(reviewedClaudeSettings) },
    { path: "apps/web/records.ts", sha256: sha(projectedContent) },
  ],
});

describe("walking-skeleton fail-closed evidence", () => {
  it("accepts pnpm's standalone argument separator", () => {
    expect(
      parseCliOptions(
        [
          "--",
          "--suite",
          "walking-skeleton",
          "--host",
          "codex",
          "--candidate-sha",
          candidateSha,
        ],
        "/repo",
      ),
    ).toMatchObject({
      mode: "run",
      options: { host: "codex", candidateSha },
    });
  });

  it("closes executor stdin so EOF-gated hosts can complete", async () => {
    const result = await executeHostCommand({
      command: process.execPath,
      args: [
        "-e",
        'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write("EOF_OK"));',
      ],
      cwd: process.cwd(),
      env: {},
      timeoutMs: 1_000,
    });
    expect(result).toEqual({
      exitCode: 0,
      stdout: "EOF_OK",
      stderr: "",
      unavailable: false,
    });
  });

  it("uses ephemeral MCP-disabled Codex and never forwards ambient credentials", async () => {
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
      hostHome: "/auth",
      sessionDir: "/run",
    });
    await adapter.run({
      cwd: "/repo",
      hostHome: "/auth",
      sessionDir: "/run",
      prompt: "test",
      timeoutMs: 1_000,
    });
    expect(calls[2]?.args).toEqual(
      expect.arrayContaining([
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "mcp_servers={}",
        "sandbox_workspace_write.network_access=true",
        'model_reasoning_effort="medium"',
      ]),
    );
    expect(
      safeHostEnvironment({
        host: "codex",
        hostHome: "/auth",
        sessionDir: "/run",
        source: { PATH: "/bin", CONVEX_DEPLOY_KEY: "secret" },
      }).CONVEX_DEPLOY_KEY,
    ).toBeUndefined();
  });
  it("requires Claude's fail-closed offline Bash sandbox", async () => {
    const calls: HostCommand[] = [];
    const adapter = createHostAdapter("claude", async (input) => {
      calls.push(input);
      return {
        exitCode: 0,
        stdout: "authenticated",
        stderr: "",
        unavailable: false,
      };
    });
    expect(adapter.isolation).toBe("workspace-offline");
    await adapter.preflight({
      cwd: "/repo",
      hostHome: "/auth",
      sessionDir: "/run",
    });
    await adapter.run({
      cwd: "/repo",
      hostHome: "/auth",
      sessionDir: "/run",
      prompt: "test",
      timeoutMs: 1_000,
      networkAccess: false,
    });
    expect(calls.map(({ command }) => command)).toEqual([
      "claude",
      "claude",
      "bwrap",
      "socat",
      "claude",
    ]);
    expect(calls[4]?.args).toEqual(
      expect.arrayContaining([
        "--setting-sources",
        "project",
        "--tools",
        "--allowedTools",
        "Bash",
        "--disallowedTools",
        "WebFetch,WebSearch,Agent,Task",
        "--strict-mcp-config",
      ]),
    );
    expect(calls[4]?.args).not.toContain("--safe-mode");
    expect(JSON.parse(claudeSandboxSettings("/auth"))).toEqual({
      enableAllProjectMcpServers: false,
      enabledPlugins: {},
      permissions: {
        allow: ["Bash"],
        deny: ["WebFetch", "WebSearch", "Agent", "Task"],
      },
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
        failIfUnavailable: true,
        allowUnsandboxedCommands: false,
        filesystem: { denyRead: ["/auth"], denyWrite: ["/auth"] },
        network: { allowedDomains: [], deniedDomains: ["*"] },
      },
    });
  });

  it("preserves the exact default Codex command without transport", async () => {
    const calls: HostCommand[] = [];
    const adapter = createHostAdapter("codex", async (input) => {
      calls.push(input);
      return { exitCode: 0, stdout: "", stderr: "", unavailable: false };
    });
    await adapter.run({
      cwd: "/repo",
      hostHome: "/auth",
      sessionDir: "/run",
      prompt: "test",
      timeoutMs: 1_000,
    });
    expect(calls[0]?.args).toEqual([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "-c",
      "mcp_servers={}",
      "-c",
      "sandbox_workspace_write.network_access=true",
      "-c",
      'model_reasoning_effort="medium"',
      "--json",
      "--sandbox",
      "workspace-write",
      "-C",
      "/repo",
      "test",
    ]);
  });

  it("adds only explicit Codex transport config while retaining isolation", async () => {
    const parsed = parseCliOptions(
      [
        "--suite",
        "walking-skeleton",
        "--host",
        "codex",
        "--candidate-sha",
        candidateSha,
        "--codex-model",
        "gpt-5.6-sol",
        "--codex-provider",
        "codex-lb",
        "--codex-base-url",
        "http://127.0.0.1:2455/backend-api/codex",
      ],
      "/repo",
    );
    expect(parsed).toMatchObject({
      mode: "run",
      options: {
        codexTransport: {
          model: "gpt-5.6-sol",
          provider_name: "codex-lb",
          base_url: "http://127.0.0.1:2455/backend-api/codex",
          wire_api: "responses",
          requires_openai_auth: true,
          supports_websockets: true,
        },
      },
    });
    if (parsed.mode !== "run" || !parsed.options.codexTransport) return;
    const calls: HostCommand[] = [];
    const adapter = createHostAdapter("codex", async (input) => {
      calls.push(input);
      return { exitCode: 0, stdout: "", stderr: "", unavailable: false };
    });
    await adapter.run({
      cwd: "/repo",
      hostHome: "/auth",
      sessionDir: "/run",
      prompt: "test",
      timeoutMs: 1_000,
      codexTransport: parsed.options.codexTransport,
    });
    expect(calls[0]?.args).toEqual([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "-c",
      "mcp_servers={}",
      "-c",
      "sandbox_workspace_write.network_access=true",
      "-c",
      'model="gpt-5.6-sol"',
      "-c",
      'model_provider="codex-lb"',
      "-c",
      'model_providers.codex-lb.name="codex-lb"',
      "-c",
      'model_providers.codex-lb.base_url="http://127.0.0.1:2455/backend-api/codex"',
      "-c",
      'model_providers.codex-lb.wire_api="responses"',
      "-c",
      "model_providers.codex-lb.requires_openai_auth=true",
      "-c",
      "model_providers.codex-lb.supports_websockets=true",
      "-c",
      'model_reasoning_effort="medium"',
      "--json",
      "--sandbox",
      "workspace-write",
      "-C",
      "/repo",
      "test",
    ]);
    expect(
      JSON.stringify(calls[0]).replaceAll("--ignore-rules", ""),
    ).not.toMatch(
      /api[_-]?key|authorization|password|secret|mcpServers\..+|plugin|rules/iu,
    );
  });

  it.each([
    ["provider", "bad.provider", "http://127.0.0.1:2455"],
    ["model", "bad model", "http://127.0.0.1:2455"],
    ["remote", "gpt-5.6-sol", "https://api.openai.com/v1"],
    ["credential", "gpt-5.6-sol", "http://token@127.0.0.1:2455"],
  ])("rejects malformed Codex transport %s", (caseName, value, baseUrl) => {
    const provider = caseName === "provider" ? value : "codex-lb";
    const model = caseName === "provider" ? "gpt-5.6-sol" : value;
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--host",
          "codex",
          "--candidate-sha",
          candidateSha,
          "--codex-model",
          model,
          "--codex-provider",
          provider,
          "--codex-base-url",
          baseUrl,
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
  });

  it("rejects partial transport and transport on Claude", () => {
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--host",
          "codex",
          "--candidate-sha",
          candidateSha,
          "--codex-model",
          "gpt-5.6-sol",
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--aggregate",
          "--run-ids",
          "a,b,c,d",
          "--candidate-sha",
          candidateSha,
          "--codex-model",
          "gpt-5.6-sol",
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--aggregate",
          "--run-ids",
          "a,b,c,d",
          "--candidate-sha",
          candidateSha,
          "--config",
          "model_provider=remote",
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--host",
          "claude",
          "--candidate-sha",
          candidateSha,
          "--codex-model",
          "gpt-5.6-sol",
          "--codex-provider",
          "codex-lb",
          "--codex-base-url",
          "http://127.0.0.1:2455",
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
  });
  it.each([
    ["credential-shaped", ["--codex-api-key", "secret"]],
    ["rules-shaped", ["--codex-rules", "override.md"]],
    ["raw config", ["--config", "model_provider=remote"]],
    ["duplicate scalar", ["--host", "codex"]],
    ["missing value", ["--product-name"]],
  ])("rejects %s CLI extras", (_caseName, extras) => {
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--host",
          "codex",
          "--candidate-sha",
          candidateSha,
          ...extras,
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
  });
  it("rejects unknown and Codex-only flags in Claude and aggregate modes", () => {
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--host",
          "claude",
          "--candidate-sha",
          candidateSha,
          "--codex-rules",
          "override.md",
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--aggregate",
          "--run-ids",
          "a,b,c,d",
          "--candidate-sha",
          candidateSha,
          "--host",
          "codex",
        ],
        "/repo",
      ),
    ).toThrowError(expect.objectContaining({ code: "EVAL_INVALID_ARGUMENT" }));
  });

  it("accepts the clean candidate-bound current projection", async () => {
    const fixture = await completeFixture();
    const evidence = await verify(fixture, canonicalCrudProof);
    expect(evidence.canonicalHashes.manifest).toMatch(/^sha256:/u);
  });
  it("does not authorize projection expectations from the host-mutated workspace", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "maestro-host-workspace-"));
    const mutableGenerator = join(
      workspace,
      "tooling/generators/src/blueprints/saasApplication.ts",
    );
    await mkdir(join(mutableGenerator, ".."), { recursive: true });
    await writeFile(
      mutableGenerator,
      "export const buildSaasApplicationTargetPlan = () => ({ digest: 'host-authored' });\n",
    );
    try {
      const projection = await createTrustedCandidateProjectionBuilder()({
        name: "SaaS Application",
        outcome: "Create and review records",
      });
      expect(projection.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(projection.digest).not.toBe("host-authored");
      expect(projection.entries.length).toBeGreaterThan(0);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects coordinated host-authored product-name projection tampering", async () => {
    const fixture = await completeFixture();
    const hostContent = "host-authored product projection\n";
    const hostProjection = {
      ...fixtureProjection({
        name: "Host Authored",
        outcome: "Create and review records",
      }),
      digest: sha("host-authored target plan"),
      entries: [
        { path: ".claude/settings.json", sha256: sha(reviewedClaudeSettings) },
        { path: "apps/web/records.ts", sha256: sha(hostContent) },
      ],
    };
    await writeFile(
      join(fixture.customerRoot, "apps/web/records.ts"),
      hostContent,
    );
    const instancePath = join(fixture.customerRoot, "template-instance.json");
    const instance = JSON.parse(await readFile(instancePath, "utf8")) as {
      release: { sourceChecksum: string };
      ownership: { manifestChecksum: string };
      blueprint: { digest: string };
      personalization: { name: string };
    };
    instance.personalization.name = "Host Authored";
    instance.blueprint.digest = hostProjection.digest;
    const releaseBytes = await readFile(
      join(fixture.workspace, "releases/v0.2.0-alpha.1/manifest.json"),
    );
    const release = JSON.parse(releaseBytes.toString("utf8")) as {
      release: {
        tag: string;
        sourceCommit: string;
        sourceChecksum: string;
      };
    };
    const authorityChecksum = sha(
      JSON.stringify({
        kind: "unreleased-current-composition",
        candidate: { sourceCommit: candidateSha },
        base: {
          manifestChecksum: shaBuffer(releaseBytes),
          tag: release.release.tag,
          sourceCommit: release.release.sourceCommit,
          sourceChecksum: release.release.sourceChecksum,
        },
        blueprint: {
          id: hostProjection.id,
          provenance: hostProjection.provenance,
          digest: hostProjection.digest,
        },
      }),
    );
    instance.release.sourceChecksum = authorityChecksum;
    instance.ownership.manifestChecksum = authorityChecksum;
    await writeFile(instancePath, JSON.stringify(instance));
    const candidateProjection = vi.fn<CandidateProjectionBuilder>(
      () => hostProjection,
    );

    await expect(
      verifyExecutableEvidence({
        workspace: fixture.workspace,
        candidateSha,
        expectedProductName: "SaaS Application",
        sessionDir: fixture.sessionDir,
        result: validResult(),
        ports: { command: verifierCommand, candidateProjection },
      }),
    ).rejects.toMatchObject({ code: "EVAL_MANIFEST_INVALID" });
    expect(candidateProjection).not.toHaveBeenCalled();
  });

  it("accepts exact reviewed Claude settings and rejects tampering", async () => {
    const fixture = await completeFixture();
    await expect(verify(fixture, canonicalCrudProof)).resolves.toBeDefined();
    await writeFile(
      join(fixture.workspace, "eval-target", ".claude", "settings.json"),
      JSON.stringify({ enableAllProjectMcpServers: true }),
    );
    await expect(verify(fixture, canonicalCrudProof)).rejects.toMatchObject({
      code: "EVAL_MANIFEST_INVALID",
    });
  });

  it.each([".claude/settings.local.json", ".mcp.json"])(
    "rejects unreviewed host configuration at %s",
    async (path) => {
      const fixture = await completeFixture();
      await writeFile(join(fixture.workspace, "eval-target", path), "{}\n");
      await expect(verify(fixture, canonicalCrudProof)).rejects.toMatchObject({
        code: "EVAL_FORBIDDEN_HOST_CONFIG",
      });
    },
  );

  it("rejects a customer instance that substitutes the frozen base commit", async () => {
    const fixture = await completeFixture();
    const path = join(
      fixture.workspace,
      "eval-target",
      "template-instance.json",
    );
    const instance = JSON.parse(await readFile(path, "utf8")) as {
      release: { sourceCommit: string };
    };
    instance.release.sourceCommit = reviewedCommit;
    await writeFile(path, JSON.stringify(instance));
    await expect(verify(fixture, canonicalCrudProof)).rejects.toMatchObject({
      code: "EVAL_MANIFEST_INVALID",
    });
  });

  it("fails closed when fake host-authored files exist but product CRUD seam does not", async () => {
    const fixture = await completeFixture();
    await writeFile(
      join(fixture.workspace, "eval-target", "record.json"),
      JSON.stringify({ id: "fake", synthetic: false }),
    );
    await writeFile(
      join(fixture.workspace, "eval-target", "captured-proof.json"),
      JSON.stringify({
        statusCode: 200,
        bodySha256: `sha256:${"0".repeat(64)}`,
      }),
    );
    await expect(verify(fixture)).rejects.toMatchObject({
      code: "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      message: expect.stringContaining("maestro:crud-proof"),
    });
  });

  it("keeps the canonical product proof live through its continuation", async () => {
    const fixture = await completeFixture();
    let proofUrl: string | undefined;
    await canonicalCrudProof({
      workspace: fixture.workspace,
      customerRoot: fixture.customerRoot,
      env: { PATH: "/bin" },
      command: verifierCommand,
      withLiveRuntime: async (proof) => {
        proofUrl = proof.url;
        const response = await fetch(proof.url);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          id: "record_0001",
          workspaceId: "workspace_crud_proof",
        });
        expect(proof.read.record).toMatchObject({ synthetic: false });
      },
    });
    expect(proofUrl).toMatch(/^http:\/\/127\.0\.0\.1:/u);
    await expect(fetch(proofUrl as string)).rejects.toThrow();
  });

  it("accepts the real generated CRUD proof contract", async () => {
    const fixture = await completeFixture();
    await expect(
      verify(fixture, async ({ customerRoot, withLiveRuntime }) =>
        runCrudProof({
          cwd: customerRoot,
          adapterModulePath: resolve(
            import.meta.dirname,
            "../../../../examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts",
          ),
          withLiveRuntime: async ({ url, proof }) =>
            withLiveRuntime({
              url,
              create: proof.create,
              read: proof.read,
            }),
        }),
      ),
    ).resolves.toMatchObject({
      serverProof: { source: "live-probe", statusCode: 200 },
    });
  });

  it("uses the default product module live and agrees with native command evidence", async () => {
    const fixture = await completeFixture();
    await installDefaultProductProof(fixture);
    let nativeProofRan = false;
    const command = vi.fn<VerifierCommand>(async (input) => {
      if (
        input.command === "pnpm" &&
        input.args[0] === "run" &&
        input.args[1] === "maestro:crud-proof"
      ) {
        nativeProofRan = true;
        const proof = await runCrudProof({ cwd: input.cwd });
        return {
          exitCode: 0,
          stdout: JSON.stringify(proof),
          stderr: "failure-looking text must not decide the verdict",
        };
      }
      return verifierCommand(input);
    });
    const browserOpen = vi.fn<BrowserOpenPort>(async ({ url }) => {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: "record_0001" });
      return { status: "opened", opener: "xdg-open" };
    });

    const evidence = await verifyExecutableEvidence({
      workspace: fixture.workspace,
      candidateSha,
      expectedProductName: "SaaS Application",
      sessionDir: fixture.sessionDir,
      result: validResult(),
      ports: { command, browserOpen, candidateProjection: fixtureProjection },
    });

    expect(nativeProofRan).toBe(true);
    expect(browserOpen).toHaveBeenCalledOnce();
    expect(evidence.browserOpen.status).toBe("opened");
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "pnpm",
        args: ["run", "maestro:crud-proof", "--", "--json"],
        cwd: fixture.customerRoot,
      }),
    );
    await expect(fetch(evidence.serverProof.url)).rejects.toThrow();
  });

  it("rejects native and live product-proof divergence before opening", async () => {
    const fixture = await completeFixture();
    await installDefaultProductProof(fixture);
    const command = vi.fn<VerifierCommand>(async (input) => {
      if (
        input.command !== "pnpm" ||
        input.args[0] !== "run" ||
        input.args[1] !== "maestro:crud-proof"
      ) {
        return verifierCommand(input);
      }
      const proof = await runCrudProof({ cwd: input.cwd });
      const divergentRecord = {
        ...proof.create.record,
        id: "record_divergent",
      };
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          ...proof,
          create: { ...proof.create, record: divergentRecord },
          read: { ...proof.read, record: divergentRecord },
        }),
        stderr: "",
      };
    });
    const browserOpen = vi.fn<BrowserOpenPort>(async () => ({
      status: "opened",
      opener: "xdg-open",
    }));

    await expect(
      verifyExecutableEvidence({
        workspace: fixture.workspace,
        candidateSha,
        expectedProductName: "SaaS Application",
        sessionDir: fixture.sessionDir,
        result: validResult(),
        ports: {
          command,
          browserOpen,
          candidateProjection: fixtureProjection,
        },
      }),
    ).rejects.toMatchObject({
      code: "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      message: expect.stringContaining("diverged"),
    });
    expect(browserOpen).not.toHaveBeenCalled();
  });

  it("falls back when the injected opener fails while product proof is live", async () => {
    const fixture = await completeFixture();
    let fetchedRecord: unknown;
    const browserOpen = vi.fn<BrowserOpenPort>(async ({ url }) => {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      fetchedRecord = await response.json();
      throw new Error("injected opener failed");
    });

    const evidence = await verifyExecutableEvidence({
      workspace: fixture.workspace,
      candidateSha,
      expectedProductName: "SaaS Application",
      sessionDir: fixture.sessionDir,
      result: validResult(),
      ports: {
        command: verifierCommand,
        productProof: canonicalCrudProof,
        browserOpen,
        candidateProjection: fixtureProjection,
      },
    });

    expect(browserOpen).toHaveBeenCalledOnce();
    expect(fetchedRecord).toMatchObject({
      id: "record_0001",
      workspaceId: "workspace_crud_proof",
    });
    expect(evidence).toMatchObject({
      browserOpen: {
        status: "headless-fallback",
        proofUrl: evidence.serverProof.url,
        reason: "opener-failed",
      },
      serverProof: {
        url: evidence.serverProof.url,
        source: "live-probe",
        statusCode: 200,
      },
    });
    await expect(fetch(evidence.serverProof.url)).rejects.toThrow();
  });

  it("records native opened success only after fetching the live product URL", async () => {
    const fixture = await completeFixture();
    const browserOpen = vi.fn<BrowserOpenPort>(
      createNativeBrowserOpenPort("linux"),
    );
    const command = vi.fn<VerifierCommand>(async (input) => {
      if (input.command !== "xdg-open") return verifierCommand(input);
      const response = await fetch(String(input.args[0]));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: "record_0001" });
      return {
        exitCode: 0,
        stdout: "",
        stderr: "Browser open failed (ignored diagnostic text).",
      };
    });

    const evidence = await verifyExecutableEvidence({
      workspace: fixture.workspace,
      candidateSha,
      expectedProductName: "SaaS Application",
      sessionDir: fixture.sessionDir,
      result: validResult(),
      ports: {
        command,
        productProof: canonicalCrudProof,
        browserOpen,
        candidateProjection: fixtureProjection,
      },
    });

    expect(evidence.browserOpen).toMatchObject({
      status: "opened",
      opener: "xdg-open",
    });
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "xdg-open",
        args: [evidence.serverProof.url],
      }),
    );
    await expect(fetch(evidence.serverProof.url)).rejects.toThrow();
  });

  it("records native fallback from exit status while the product URL is live", async () => {
    const fixture = await completeFixture();
    const browserOpen = createNativeBrowserOpenPort("linux");
    const command = vi.fn<VerifierCommand>(async (input) => {
      if (input.command !== "xdg-open") return verifierCommand(input);
      expect((await fetch(String(input.args[0]))).status).toBe(200);
      return {
        exitCode: 1,
        stdout: "opened",
        stderr: "",
      };
    });

    const evidence = await verifyExecutableEvidence({
      workspace: fixture.workspace,
      candidateSha,
      expectedProductName: "SaaS Application",
      sessionDir: fixture.sessionDir,
      result: validResult(),
      ports: {
        command,
        productProof: canonicalCrudProof,
        browserOpen,
        candidateProjection: fixtureProjection,
      },
    });

    expect(evidence.browserOpen).toMatchObject({
      status: "headless-fallback",
      opener: "xdg-open",
      reason: "opener-failed",
    });
    await expect(fetch(evidence.serverProof.url)).rejects.toThrow();
  });

  it("does not let browser opener failure manufacture CRUD proof", async () => {
    const fixture = await completeFixture();
    const browserOpen = vi.fn<BrowserOpenPort>(async () => ({
      status: "headless-fallback",
      reason: "opener-failed",
    }));
    const productProof = vi.fn<ProductProofRunner>(
      async ({ withLiveRuntime }) =>
        withLiveRuntime({
          url: "http://127.0.0.1:4173/records/record-1",
          create: {
            statusCode: 201,
            record: { id: "record-1", synthetic: false },
          },
          read: {
            statusCode: 404,
            record: { id: "record-1", synthetic: false },
          },
        }),
    );

    await expect(
      verifyExecutableEvidence({
        workspace: fixture.workspace,
        candidateSha,
        expectedProductName: "SaaS Application",
        sessionDir: fixture.sessionDir,
        result: validResult(),
        ports: {
          command: verifierCommand,
          productProof,
          browserOpen,
          candidateProjection: fixtureProjection,
        },
      }),
    ).rejects.toMatchObject({
      code: "EVAL_PRODUCT_PROOF_UNAVAILABLE",
    });
    expect(browserOpen).not.toHaveBeenCalled();
  });

  it("rejects missing frozen-install evidence offline before product proof", async () => {
    const fixture = await completeFixture();
    await writeFile(
      join(fixture.workspace, "node_modules", ".modules.yaml"),
      "",
    );
    const productProof = vi.fn(canonicalCrudProof);
    const command = vi.fn<VerifierCommand>(async (input) => {
      if (input.command === "git") return verifierCommand(input);
      throw new Error("Offline fixture attempted package or product access.");
    });
    await expect(
      verifyExecutableEvidence({
        workspace: fixture.workspace,
        candidateSha,
        expectedProductName: "SaaS Application",
        sessionDir: fixture.sessionDir,
        result: validResult(),
        ports: {
          command,
          productProof,
          candidateProjection: fixtureProjection,
        },
      }),
    ).rejects.toMatchObject({
      code: "EVAL_PREREQUISITE_EVIDENCE_MISSING",
    });
    expect(command).toHaveBeenCalledTimes(2);
    expect(command.mock.calls.every(([input]) => input.command === "git")).toBe(
      true,
    );
    expect(productProof).not.toHaveBeenCalled();
  });

  it("isolates stale plugin config and passes the repaired rerun", async () => {
    const fixture = await completeFixture();
    const stalePlugin = join(
      fixture.workspace,
      "eval-target",
      ".claude-plugin",
    );
    await mkdir(stalePlugin);
    await writeFile(join(stalePlugin, "plugin.json"), "{}\n");

    await expect(verify(fixture, canonicalCrudProof)).rejects.toMatchObject({
      code: "EVAL_FORBIDDEN_HOST_CONFIG",
      message: expect.stringContaining("removed before rerun"),
    });

    await rm(stalePlugin, { recursive: true });
    await expect(verify(fixture, canonicalCrudProof)).resolves.toMatchObject({
      serverProof: { source: "live-probe", statusCode: 200 },
    });
  });

  it("still aggregates exactly two equivalent runs per host", async () => {
    const out = await mkdtemp(join(tmpdir(), "maestro-eval-suite-"));
    const runIds = ["claude-1", "claude-2", "codex-1", "codex-2"];
    const canonicalHashes = {
      manifest: sha("manifest"),
      gateSet: sha("gates"),
      verticalSlice: sha("projection"),
      firstRecord: sha("record"),
      checkExecution: sha("check"),
    };
    for (const runId of runIds) {
      await mkdir(join(out, runId));
      await writeFile(
        join(out, runId, "receipt.json"),
        JSON.stringify({
          host: runId.startsWith("claude") ? "claude" : "codex",
          runId,
          candidateSha,
          status: "passed",
          canonicalHashes,
        }),
      );
    }
    await expect(
      aggregateWalkingSkeletonRuns({
        out,
        runIds,
        candidateSha,
        suiteRunId: "suite",
      }),
    ).resolves.toMatchObject({ status: "passed", canonicalHashes });
  });
});

async function completeFixture() {
  const root = await mkdtemp(join(tmpdir(), "maestro-eval-proof-"));
  const workspace = join(root, "workspace");
  const sessionDir = join(root, "session");
  const customerRoot = join(workspace, "eval-target");
  await mkdir(join(workspace, "node_modules"), { recursive: true });
  await mkdir(join(workspace, "releases", "v0.2.0-alpha.1", "blueprints"), {
    recursive: true,
  });
  await mkdir(join(customerRoot, "apps", "web"), { recursive: true });
  await mkdir(join(customerRoot, ".claude"), { recursive: true });
  await mkdir(sessionDir);
  await writeFile(
    join(workspace, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\n# frozen\n# frozen\n# frozen\n",
  );
  await writeFile(
    join(workspace, "node_modules", ".modules.yaml"),
    "virtualStoreDir: .pnpm\nvirtualStoreDirMaxLength: 120\n",
  );

  const release = {
    schemaVersion: 1,
    kind: "composed-customer-release",
    materializationStatus: "materializable",
    release: {
      version: "0.2.0-alpha.1",
      tag: "maestro-template-v0.2.0-alpha.1",
      sourceCommit: reviewedCommit,
      sourceChecksum: sha("reviewed archive"),
    },
  };
  const releaseBytes = Buffer.from(`${JSON.stringify(release, null, 2)}\n`);
  await writeFile(
    join(workspace, "releases", "v0.2.0-alpha.1", "manifest.json"),
    releaseBytes,
  );
  await writeFile(
    join(customerRoot, "apps", "web", "records.ts"),
    projectedContent,
  );
  await writeFile(
    join(customerRoot, ".claude", "settings.json"),
    reviewedClaudeSettings,
  );
  const blueprint = {
    schemaVersion: 1,
    id: "saas-application",
    provenance: "@maestro-template/generators/saas-application@1",
    entries: [
      { path: ".claude/settings.json", sha256: sha(reviewedClaudeSettings) },
      { path: "apps/web/records.ts", sha256: sha(projectedContent) },
    ],
  };
  await writeFile(
    join(
      workspace,
      "releases",
      "v0.2.0-alpha.1",
      "blueprints",
      "saas-application.json",
    ),
    `${JSON.stringify(blueprint, null, 2)}\n`,
  );
  const authorityChecksum = sha(
    JSON.stringify({
      kind: "unreleased-current-composition",
      candidate: { sourceCommit: candidateSha },
      base: {
        manifestChecksum: shaBuffer(releaseBytes),
        tag: release.release.tag,
        sourceCommit: release.release.sourceCommit,
        sourceChecksum: release.release.sourceChecksum,
      },
      blueprint: {
        id: blueprint.id,
        provenance: blueprint.provenance,
        digest: sha("target plan"),
      },
    }),
  );
  await writeFile(
    join(customerRoot, "template-instance.json"),
    JSON.stringify({
      schemaVersion: 1,
      release: {
        version: "unreleased-current",
        tag: "unreleased-current",
        sourceCommit: candidateSha,
        sourceChecksum: authorityChecksum,
      },
      compatibility: {
        cli: "unreleased-current",
        agentPack: "unreleased-current",
      },
      ownership: {
        manifest: "unreleased-current-composition",
        manifestChecksum: authorityChecksum,
      },
      blueprint: {
        id: blueprint.id,
        provenance: blueprint.provenance,
        digest: sha("target plan"),
      },
      personalization: {
        name: "SaaS Application",
        firstOutcome: "Create and review records",
        demoOnly: true,
      },
    }),
  );
  await writeFile(
    join(customerRoot, "receipt.json"),
    JSON.stringify(validReceipt()),
  );
  await writeFile(
    join(customerRoot, "package.json"),
    JSON.stringify({ scripts: {} }),
  );
  return { workspace, sessionDir, customerRoot };
}

async function installDefaultProductProof(fixture: {
  workspace: string;
  customerRoot: string;
}) {
  const sourceRoot = resolve(import.meta.dirname, "../../../..");
  const productModuleDirectory = join(
    fixture.workspace,
    "tooling",
    "generators",
    "src",
  );
  const adapterDirectory = join(
    fixture.customerRoot,
    "apps",
    "web",
    "src",
    "adapters",
    "records",
  );
  await mkdir(productModuleDirectory, { recursive: true });
  await Promise.all([
    cp(
      join(sourceRoot, "tooling/generators/src/crud-proof.ts"),
      join(productModuleDirectory, "crud-proof.ts"),
    ),
    cp(
      join(sourceRoot, "tooling/generators/src/direct-run.ts"),
      join(productModuleDirectory, "direct-run.ts"),
    ),
    cp(
      join(
        sourceRoot,
        "examples/saas-application/seed/source/apps/web/src/adapters/records",
      ),
      adapterDirectory,
      { recursive: true },
    ),
    writeFile(
      join(fixture.customerRoot, "package.json"),
      JSON.stringify({
        scripts: {
          "maestro:crud-proof":
            "tsx tooling/generators/src/crud-proof.ts --mode fake",
        },
      }),
    ),
  ]);
}

function validResult(): WalkingSkeletonResult {
  return {
    schemaVersion: 2,
    candidateSha,
    customerTarget: "eval-target",
    milestones: [],
    interventions: [],
    evidence: {
      manifestPath: "eval-target/template-instance.json",
      receiptPath: "eval-target/receipt.json",
    },
    explanation: { works: "works", demoOnly: "fake", nextAction: "next" },
  };
}

async function verify(
  fixture: { workspace: string; sessionDir: string },
  productProof?: ProductProofRunner,
) {
  return verifyExecutableEvidence({
    workspace: fixture.workspace,
    candidateSha,
    expectedProductName: "SaaS Application",
    sessionDir: fixture.sessionDir,
    result: validResult(),
    ports: {
      command: verifierCommand,
      candidateProjection: fixtureProjection,
      ...(productProof ? { productProof } : {}),
    },
  });
}

const verifierCommand: VerifierCommand = async (input) => {
  if (input.command === "git" && input.args[0] === "rev-parse") {
    return { exitCode: 0, stdout: `${candidateSha}\n`, stderr: "" };
  }
  if (input.command === "git") return { exitCode: 0, stdout: "", stderr: "" };
  return { exitCode: 0, stdout: '{"status":"pass"}', stderr: "" };
};

const canonicalCrudProof: ProductProofRunner = async ({
  customerRoot,
  withLiveRuntime,
}) => {
  await runCrudProof({
    cwd: customerRoot,
    adapterModulePath: resolve(
      import.meta.dirname,
      "../../../../examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts",
    ),
    withLiveRuntime: async ({ url, proof }) =>
      withLiveRuntime({
        url,
        create: proof.create,
        read: proof.read,
      }),
  });
};

function validReceipt() {
  return {
    schemaVersion: 1,
    command: { id: "check", version: 1 },
    fingerprints: { repository: "repository_sha256:abc" },
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

function sha(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function shaBuffer(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
