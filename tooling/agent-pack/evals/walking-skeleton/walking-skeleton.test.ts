import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runCrudProof } from "../../../generators/src/crud-proof.js";
import { aggregateWalkingSkeletonRuns } from "./aggregate.js";
import { parseCliOptions } from "./cli.js";
import type { WalkingSkeletonResult } from "./contract.js";
import {
  createHostAdapter,
  safeHostEnvironment,
  type HostCommand,
} from "./hosts.js";
import {
  verifyExecutableEvidence,
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
        "mcp_servers={}",
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

  it("accepts the frozen reviewed release binding rather than candidate HEAD", async () => {
    const fixture = await completeFixture();
    const evidence = await verify(fixture, localCrudProof);
    expect(evidence.canonicalHashes.manifest).toMatch(/^sha256:/u);
  });

  it("accepts exact reviewed Claude settings and rejects tampering", async () => {
    const fixture = await completeFixture();
    await expect(verify(fixture, localCrudProof)).resolves.toBeDefined();
    await writeFile(
      join(fixture.workspace, "eval-target", ".claude", "settings.json"),
      JSON.stringify({ enableAllProjectMcpServers: true }),
    );
    await expect(verify(fixture, localCrudProof)).rejects.toMatchObject({
      code: "EVAL_MANIFEST_INVALID",
    });
  });

  it.each([".claude/settings.local.json", ".mcp.json"])(
    "rejects unreviewed host configuration at %s",
    async (path) => {
      const fixture = await completeFixture();
      await writeFile(join(fixture.workspace, "eval-target", path), "{}\n");
      await expect(verify(fixture, localCrudProof)).rejects.toMatchObject({
        code: "EVAL_FORBIDDEN_HOST_CONFIG",
      });
    },
  );

  it("rejects a fabricated customer instance that substitutes candidate HEAD", async () => {
    const fixture = await completeFixture();
    const path = join(
      fixture.workspace,
      "eval-target",
      "template-instance.json",
    );
    const instance = JSON.parse(await readFile(path, "utf8")) as {
      release: { sourceCommit: string };
    };
    instance.release.sourceCommit = candidateSha;
    await writeFile(path, JSON.stringify(instance));
    await expect(verify(fixture, localCrudProof)).rejects.toMatchObject({
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

  it("proves a harness-owned local server can exercise create and read", async () => {
    const proof = await localCrudProof({
      customerRoot: "/unused",
      env: { PATH: "/bin" },
      command: verifierCommand,
    });
    expect(proof.create.statusCode).toBe(201);
    expect(proof.read.record).toEqual(proof.create.record);
    expect(proof.url).toMatch(/^http:\/\/127\.0\.0\.1:/u);
  });

  it("accepts the real generated CRUD proof contract", async () => {
    const fixture = await completeFixture();
    await expect(
      verify(fixture, async ({ customerRoot }) =>
        runCrudProof({
          cwd: customerRoot,
          adapterModulePath: resolve(
            import.meta.dirname,
            "../../../../examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts",
          ),
        }),
      ),
    ).resolves.toMatchObject({
      serverProof: { source: "live-probe", statusCode: 200 },
    });
  });

  it("rejects missing frozen-install evidence before product proof", async () => {
    const fixture = await completeFixture();
    await writeFile(
      join(fixture.workspace, "node_modules", ".modules.yaml"),
      "",
    );
    await expect(verify(fixture, localCrudProof)).rejects.toMatchObject({
      code: "EVAL_PREREQUISITE_EVIDENCE_MISSING",
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
  const projectedContent =
    "export type RecordItem = { id: string; title: string };\nexport const recordsRoute = '/records';\n";
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
  await writeFile(
    join(customerRoot, "template-instance.json"),
    JSON.stringify({
      schemaVersion: 1,
      release: release.release,
      ownership: {
        manifest: "releases/v0.2.0-alpha.1/manifest.json",
        manifestChecksum: shaBuffer(releaseBytes),
      },
      blueprint: {
        id: blueprint.id,
        provenance: blueprint.provenance,
        digest: sha("target plan"),
      },
      personalization: { demoOnly: true },
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
  return { workspace, sessionDir };
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
    sessionDir: fixture.sessionDir,
    result: validResult(),
    ports: {
      command: verifierCommand,
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

const localCrudProof: ProductProofRunner = async () => {
  let record: Record<string, unknown> | undefined;
  const server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/records") {
      record = { id: "record-1", title: "First record", synthetic: false };
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify(record));
      return;
    }
    if (
      request.method === "GET" &&
      request.url === "/records/record-1" &&
      record
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(record));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolveReady) =>
    server.listen(0, "127.0.0.1", resolveReady),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("server unavailable");
  const url = `http://127.0.0.1:${String(address.port)}`;
  try {
    const created = await fetch(`${url}/records`, { method: "POST" });
    const read = await fetch(`${url}/records/record-1`);
    return {
      url,
      create: { statusCode: created.status, record: await created.json() },
      read: { statusCode: read.status, record: await read.json() },
    };
  } finally {
    await new Promise<void>((resolveClosed, reject) =>
      server.close((error) => (error ? reject(error) : resolveClosed())),
    );
  }
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
