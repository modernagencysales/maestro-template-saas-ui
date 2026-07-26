import { diagnosticRegistryDescriptors } from "@maestro-template/quality-tooling";
import { WORKFLOW_SEMANTICS } from "@maestro-template/template-core/workflow-semantics";
import { describe, expect, it } from "vitest";
import {
  createRepositoryContext,
  evaluateReceiptStaleness,
} from "@maestro-template/agent-pack";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  FACTORY_EXECUTION_POLICY,
  createFactoryCliComposition,
  projectCompositionEnvironment,
  projectCompositionProviderPosture,
} from "./composition";

const factoryCliComposition = createFactoryCliComposition(() => ({}));
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function cleanGitTarget(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "maestro-read-only-"));
  await writeFile(root + "/package.json", '{"name":"fixture"}\n');
  await writeFile(
    root + "/template-instance.json",
    '{"name":"Fixture","slug":"fixture","providerMode":"fake","providers":{}}\n',
  );
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "package.json", "template-instance.json"], {
    cwd: root,
  });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Maestro Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    ],
    { cwd: root },
  );
  return root;
}

async function targetFiles(root: string): Promise<readonly string[]> {
  const paths = (await readdir(root, { recursive: true }))
    .filter((path) => path !== ".git" && !path.startsWith(".git/"))
    .sort();
  return Promise.all(
    paths.map(async (path) => {
      const absolute = join(root, path);
      const status = await lstat(absolute);
      if (!status.isFile()) return `${path}:directory`;
      const hash = createHash("sha256")
        .update(await readFile(absolute))
        .digest("hex");
      return `${path}:file:${hash}`;
    }),
  );
}

async function configuredGitTarget(): Promise<string> {
  const root = await cleanGitTarget();
  await mkdir(join(root, "docs/template"), { recursive: true });
  for (const name of [
    "system-catalog.json",
    "data-resources.json",
    "product-topology.json",
  ]) {
    await writeFile(
      join(root, "docs/template", name),
      await readFile(join(repositoryRoot, "docs/template", name)),
    );
  }
  await writeFile(
    join(root, "docs/template/env-manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      variables: [
        {
          name: "CONVEX_DEPLOYMENT",
          group: "convex",
          requiredFor: ["live"],
        },
      ],
    })}\n`,
  );
  await writeFile(
    join(root, "template-instance.json"),
    `${JSON.stringify({
      name: "Fixture",
      slug: "fixture",
      providerMode: "test",
      modules: [],
      providers: { convex: "configured" },
    })}\n`,
  );
  execFileSync("git", ["add", "docs/template", "template-instance.json"], {
    cwd: root,
  });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Maestro Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "configure provider",
    ],
    { cwd: root },
  );
  return root;
}

describe("factory CLI composition", () => {
  it("binds one explicit policy to canonical readers and thirteen commands", () => {
    expect(
      factoryCliComposition.handlers.map(({ command }) => command),
    ).toEqual([
      "create",
      "adopt",
      "start",
      "add",
      "recipes",
      "doctor",
      "preflight",
      "verify",
      "verify-export",
      "check",
      "plan-check",
      "scaffold",
      "support-bundle",
    ]);
    expect(factoryCliComposition.diagnosticCount).toBe(
      diagnosticRegistryDescriptors.length,
    );
    expect(factoryCliComposition.workflowRuleCount).toBe(
      WORKFLOW_SEMANTICS.length,
    );
    expect(FACTORY_EXECUTION_POLICY).toMatchObject({
      supportedPlatforms: ["linux", "darwin", "win32"],
      supportedNodeMajors: [22],
      requiredPorts: [],
      packageJsonMaxBytes: 256 * 1024,
    });
  });

  it("imports generator and quality sources without running either CLI", () => {
    expect(process.exitCode).toBeUndefined();
    expect(factoryCliComposition.handlers).toHaveLength(13);
  });

  it("routes exact start help without spawning", async () => {
    const start = factoryCliComposition.handlers.find(
      ({ command }) => command === "start",
    );
    await expect(
      start?.run(["start", "--help"], "/tmp/customer-app"),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout:
        "maestro start [--mode fake|local|dev] [--human|--details|--json]\n",
      stderr: "",
    });
  });

  it("projects repository-aware environment names without values", () => {
    let deployment = "deployment-one-secret";
    const first = projectCompositionEnvironment(
      createRepositoryContext({ cwd: "/tmp/customer-app" }),
      () => ({
        BUILDKITE: "true",
        OPENROUTER_API_KEY: "fake",
        CONVEX_DEPLOYMENT: deployment,
        EMPTY: "",
      }),
    );

    deployment = "deployment-two-secret";
    const second = projectCompositionEnvironment(
      createRepositoryContext({ cwd: "/tmp/customer-app" }),
      () => ({
        BUILDKITE: "true",
        OPENROUTER_API_KEY: "fake",
        CONVEX_DEPLOYMENT: deployment,
        EMPTY: "",
      }),
    );

    expect(first).toMatchObject({
      sourceRoot: "/tmp/customer-app",
      targetRoot: "/tmp/customer-app",
      ci: true,
      availableEnvironmentNames:
        "BUILDKITE,CONVEX_DEPLOYMENT,OPENROUTER_API_KEY",
    });
    expect(second).toEqual(first);
    expect(JSON.stringify([first, second])).not.toMatch(
      /deployment-(?:one|two)-secret/,
    );
    for (const value of ["deployment-one-secret", "deployment-two-secret"]) {
      expect(JSON.stringify([first, second])).not.toContain(
        createHash("sha256").update(value).digest("hex"),
      );
    }
  });

  it("binds provider posture to mode and required environment names", () => {
    let deployment = "secret-deployment-one";
    const input = () => ({
      repo: createRepositoryContext({ cwd: "/tmp/customer-app" }),
      instance: {
        providerMode: "test" as const,
        providers: {
          convex: "configured" as const,
          llm: "configured" as const,
          email: "console" as const,
          storage: "local" as const,
          posthog: "fake" as const,
        },
      },
      readEnvironment: () => ({
        CONVEX_DEPLOYMENT: deployment,
      }),
      requiredEnvironmentNames: (provider: string) =>
        provider === "convex"
          ? ["CONVEX_DEPLOYMENT"]
          : provider === "llm"
            ? ["OPENAI_API_KEY"]
            : [],
    });
    const first = projectCompositionProviderPosture(input());
    deployment = "secret-deployment-two";
    const second = projectCompositionProviderPosture(input());

    expect(first).toEqual({
      convex: "test",
      llm: "missing",
      email: "local",
      storage: "local",
      posthog: "sample",
    });
    expect(second).toEqual(first);
    expect(JSON.stringify([first, second])).not.toMatch(
      /secret-deployment-(?:one|two)/,
    );
  });

  it("executes canonical non-empty defaults through real CLI and MCP composition", async () => {
    const expectedGateIds = [
      "gates",
      "secret-canaries",
      "headless-surface-contract",
      "workflow-semantics",
    ];
    const secretCanariesStatus =
      spawnSync("gitleaks", ["version"], { encoding: "utf8" }).status === 0
        ? "pass"
        : "unavailable";
    const expectedStatuses = ["pass", secretCanariesStatus, "pass", "pass"];
    const verify = factoryCliComposition.handlers.find(
      ({ command }) => command === "verify",
    );
    const cli = await verify?.run(["verify", "--json"], repositoryRoot);
    const cliPayload = JSON.parse(cli?.stdout ?? "null");

    expect(
      cliPayload.data.receipt.gates.map(
        ({ gateId }: { gateId: string }) => gateId,
      ),
    ).toEqual(expectedGateIds);
    expect(cliPayload.data.receipt.gates).toHaveLength(expectedGateIds.length);
    expect(
      cliPayload.data.receipt.gates.map(
        ({ status }: { status: string }) => status,
      ),
    ).toEqual(expectedStatuses);

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let frames = "";
    stdout.on("data", (chunk) => (frames += String(chunk)));
    await factoryCliComposition.mcp.serve({
      stdin: Readable.from([
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "maestro_verify", arguments: {} },
        })}\n`,
      ]),
      stdout,
      stderr,
      cwd: repositoryRoot,
    });
    const mcpFrame = JSON.parse(frames.trim());
    const mcpPayload = JSON.parse(mcpFrame.result.content[0].text);
    expect(
      mcpPayload.data.receipt.gates.map(
        ({ gateId }: { gateId: string }) => gateId,
      ),
    ).toEqual(expectedGateIds);
    expect(mcpPayload.data.receipt.gates).toHaveLength(expectedGateIds.length);
    expect(
      mcpPayload.data.receipt.gates.map(
        ({ status }: { status: string }) => status,
      ),
    ).toEqual(expectedStatuses);

    for (const payload of [cliPayload, mcpPayload]) {
      if (secretCanariesStatus === "unavailable") {
        expect(payload.data.summary).toMatchObject({
          status: "fail",
          requiredFailures: ["secret-canaries"],
          unavailable: ["secret-canaries"],
        });
        expect(payload.diagnostics).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "secret-canaries",
              message: expect.stringContaining(
                "required prerequisite gitleaks version was unavailable",
              ),
            }),
          ]),
        );
      } else {
        expect(payload.data.summary).toMatchObject({
          status: "pass",
          requiredFailures: [],
          unavailable: [],
        });
        expect(
          payload.diagnostics.map(({ code }: { code: string }) => code),
        ).not.toContain("secret-canaries");
      }
    }
  }, 60_000);

  it("keeps the canonical gate unavailable in real CLI and MCP processes when gitleaks is absent", () => {
    const environment = {
      ...process.env,
      PATH: "/usr/local/bin:/usr/bin:/bin",
    };
    const expectedGateIds = [
      "gates",
      "secret-canaries",
      "headless-surface-contract",
      "workflow-semantics",
    ];
    const expectedStatuses = ["pass", "unavailable", "pass", "pass"];
    const cli = spawnSync(
      "pnpm",
      ["--silent", "maestro", "--", "verify", "--json"],
      {
        cwd: repositoryRoot,
        env: environment,
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    expect(cli.error).toBeUndefined();
    const cliPayload = JSON.parse(cli.stdout);
    expect(
      cliPayload.data.receipt.gates.map(
        ({ gateId }: { gateId: string }) => gateId,
      ),
    ).toEqual(expectedGateIds);
    expect(
      cliPayload.data.receipt.gates.map(
        ({ status }: { status: string }) => status,
      ),
    ).toEqual(expectedStatuses);
    expect(cliPayload.data.summary).toMatchObject({
      status: "fail",
      requiredFailures: ["secret-canaries"],
      unavailable: ["secret-canaries"],
    });

    const mcp = spawnSync("pnpm", ["--silent", "maestro", "--", "mcp"], {
      cwd: repositoryRoot,
      env: environment,
      encoding: "utf8",
      input: `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "maestro_verify", arguments: {} },
      })}\n`,
      timeout: 60_000,
    });
    expect(mcp.error).toBeUndefined();
    const frame = JSON.parse(mcp.stdout.trim());
    const mcpPayload = JSON.parse(frame.result.content[0].text);
    expect(
      mcpPayload.data.receipt.gates.map(
        ({ gateId }: { gateId: string }) => gateId,
      ),
    ).toEqual(expectedGateIds);
    expect(
      mcpPayload.data.receipt.gates.map(
        ({ status }: { status: string }) => status,
      ),
    ).toEqual(expectedStatuses);
    expect(mcpPayload.data.summary).toMatchObject({
      status: "fail",
      requiredFailures: ["secret-canaries"],
      unavailable: ["secret-canaries"],
    });
  }, 150_000);

  it("stales real preflight and receipt bindings when configured values change under the same names", async () => {
    const root = await configuredGitTarget();
    let deployment = "test:account-one-secret";
    const composition = createFactoryCliComposition(() => ({
      CONVEX_DEPLOYMENT: deployment,
    }));
    const preflight = composition.handlers.find(
      ({ command }) => command === "preflight",
    );
    const verify = composition.handlers.find(
      ({ command }) => command === "verify",
    );
    const firstPreflight = JSON.parse(
      (await preflight?.run(["preflight", "--mode", "test", "--json"], root))
        ?.stdout ?? "null",
    );
    const firstVerify = JSON.parse(
      (await verify?.run(["verify", "--json"], root))?.stdout ?? "null",
    );

    deployment = "test:account-two-secret";
    const secondPreflight = JSON.parse(
      (await preflight?.run(["preflight", "--mode", "test", "--json"], root))
        ?.stdout ?? "null",
    );
    const secondVerify = JSON.parse(
      (await verify?.run(["verify", "--json"], root))?.stdout ?? "null",
    );
    expect(firstPreflight.data, JSON.stringify(firstPreflight)).not.toBeNull();
    expect(
      secondPreflight.data,
      JSON.stringify(secondPreflight),
    ).not.toBeNull();
    const currentReceipt = secondVerify.data.receipt;
    const staleness = evaluateReceiptStaleness(firstVerify.data.receipt, {
      subject: currentReceipt.subject,
      repositoryFingerprint: currentReceipt.fingerprints.repository,
      environmentFingerprint: currentReceipt.fingerprints.environment,
      providerPostureFingerprint: currentReceipt.fingerprints.providerPosture,
    });
    const serialized = JSON.stringify([
      firstPreflight,
      firstVerify,
      secondPreflight,
      secondVerify,
    ]);

    expect(secondPreflight.data.fingerprint).not.toBe(
      firstPreflight.data.fingerprint,
    );
    expect(staleness.reasons).toEqual(
      expect.arrayContaining([
        "environment-changed",
        "provider-posture-changed",
      ]),
    );
    expect(serialized).not.toMatch(/test:account-(?:one|two)-secret/);
    for (const value of [
      "test:account-one-secret",
      "test:account-two-secret",
    ]) {
      expect(serialized).not.toContain(
        createHash("sha256").update(value).digest("hex"),
      );
    }
  }, 30_000);

  it("changes no target file during default CLI verify", async () => {
    const root = await cleanGitTarget();
    const before = await targetFiles(root);
    const verify = factoryCliComposition.handlers.find(
      ({ command }) => command === "verify",
    );

    const result = await verify?.run(["verify", "--json"], root);

    expect(result?.stdout).toContain('"mutationPosture": "read-only"');
    expect(await targetFiles(root)).toEqual(before);
  }, 20_000);

  it("changes no target file during default CLI check", async () => {
    const root = await cleanGitTarget();
    const before = await targetFiles(root);
    const check = factoryCliComposition.handlers.find(
      ({ command }) => command === "check",
    );

    const result = await check?.run(["check", "--json"], root);

    expect(result?.stdout).toContain('"mutationPosture": "read-only"');
    expect(await targetFiles(root)).toEqual(before);
  }, 20_000);

  it("changes no target file during MCP verify", async () => {
    const root = await cleanGitTarget();
    const before = await targetFiles(root);
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let frames = "";
    stdout.on("data", (chunk) => (frames += String(chunk)));

    await factoryCliComposition.mcp.serve({
      stdin: Readable.from([
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "maestro_verify", arguments: {} },
        })}\n`,
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "maestro_verify",
            arguments: { scope: "full" },
          },
        })}\n`,
      ]),
      stdout,
      stderr,
      cwd: root,
    });

    expect(frames).toContain('"mutationPosture":"read-only"');
    expect(frames).toContain('"id":2');
    expect(await targetFiles(root)).toEqual(before);
  }, 30_000);
});
