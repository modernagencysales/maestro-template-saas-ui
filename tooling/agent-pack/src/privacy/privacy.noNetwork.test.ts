import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCustomerCreateComposition,
  type CustomerCompositionSource,
} from "../../../../apps/cli/src/factory/createComposition";
import { buildSaasApplicationTargetPlan } from "../../../../tooling/generators/src/index";
import { buildCustomerOwnershipInventory } from "../../../../tooling/release/src/customerTarget/ownership";
import { NO_NETWORK_FACTORY_CASES } from "./networkPolicy.js";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "maestro-no-network-"));
const attemptsPath = join(fixtureRoot, "attempts.ndjson");
const customerTarget = join(fixtureRoot, "customer-app");
let candidateReleaseParent: string | undefined;
const candidateRelease = (input: {
  readonly name: string;
  readonly outcome: string;
}): {
  readonly root: string;
  readonly replacements: ReadonlyMap<string, "copy" | "generate" | undefined>;
  readonly source: CustomerCompositionSource;
} => {
  candidateReleaseParent = mkdtempSync(
    join(tmpdir(), "maestro-no-network-candidate-"),
  );
  const root = join(candidateReleaseParent, "release");
  execFileSync(
    "git",
    ["clone", "--quiet", "--shared", "--no-tags", repositoryRoot, root],
    { stdio: "pipe" },
  );
  const authorityRoot = join(root, ".candidate-authority");
  appendFileSync(join(root, ".git/info/exclude"), "\n.candidate-authority/\n");
  mkdirSync(authorityRoot, { recursive: true });
  const sourceCommit = git(root, ["rev-parse", "HEAD"]).trim();
  const tag = "maestro-template-v0.2.0-alpha.3";
  const plan = buildSaasApplicationTargetPlan({
    name: input.name,
    firstOutcome: input.outcome,
  });
  const blueprintOwnedPaths = new Set(
    plan.entries
      .filter((entry) => entry.replaces === undefined)
      .map((entry) => entry.path),
  );
  const sourcePaths = git(root, ["ls-tree", "-r", "--name-only", sourceCommit])
    .trim()
    .split("\n")
    .filter(Boolean);
  const paths = [
    ...buildCustomerOwnershipInventory(sourcePaths).map((entry) =>
      blueprintOwnedPaths.has(entry.path)
        ? {
            path: entry.path,
            match: "exact" as const,
            ownership: "factory-only" as const,
            action: "omit" as const,
            upgrade: "remove" as const,
          }
        : entry,
    ),
    {
      path: "template-instance.json",
      match: "exact" as const,
      ownership: "generated" as const,
      action: "generate" as const,
      upgrade: "regenerate" as const,
    },
  ];
  const manifest = {
    $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
    schemaVersion: 1,
    materializationStatus: "materializable",
    release: {
      version: "0.2.0-alpha.3",
      tag,
      sourceCommit,
      sourceChecksum: hash(
        git(root, ["archive", "--format=tar", sourceCommit]),
      ),
    },
    compatibility: { cli: "0.2.x", agentPack: "0.2.x" },
    paths,
    expectedHashes: Object.fromEntries(
      paths
        .filter((entry) => entry.action === "copy" && entry.match === "exact")
        .map((entry) => [
          entry.path,
          hash(readFileSync(join(root, entry.path))),
        ]),
    ),
    extensionSeams: paths
      .filter((entry) => entry.ownership === "customer-extension")
      .map((entry) => ({
        path: entry.path,
        description: "No-network candidate customer extension seam.",
      })),
  };
  const manifestPath = join(authorityRoot, "manifest.json");
  const manifestBytes = writeJson(manifestPath, manifest);
  const blueprint = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    registrations: plan.registrations,
    parameterizedEntries: plan.parameterizedEntries,
    entries: plan.entries.map((entry) => ({
      path: entry.path,
      ownership: entry.ownership,
      action: entry.action,
      upgrade: entry.upgrade,
      sha256: entry.sha256,
      ...(entry.replaces === undefined ? {} : { replaces: entry.replaces }),
    })),
  };
  const blueprintManifestPath = join(authorityRoot, "blueprint.json");
  const blueprintManifestBytes = writeJson(blueprintManifestPath, blueprint);
  const blueprintAuthorityManifestPath = join(
    authorityRoot,
    "blueprint-authority.json",
  );
  const blueprintAuthorityManifestBytes = writeJson(
    blueprintAuthorityManifestPath,
    blueprint,
  );
  git(root, ["add", "--force", ".candidate-authority"]);
  git(root, [
    "-c",
    "user.name=Maestro No-Network Fixture",
    "-c",
    "user.email=maestro-no-network-fixture@example.invalid",
    "commit",
    "--quiet",
    "--no-verify",
    "-m",
    "test: seal no-network candidate authority",
  ]);
  git(root, ["tag", "-f", tag]);
  return {
    root,
    replacements: new Map(
      plan.entries.map(({ path, replaces }) => [path, replaces] as const),
    ),
    source: {
      repositoryRoot: root,
      manifestPath,
      ownershipManifestChecksum: hash(manifestBytes),
      tag,
      sourceCommit,
      blueprintManifestPath,
      blueprintManifestChecksum: hash(blueprintManifestBytes),
      blueprintAuthorityManifestPath,
      blueprintAuthorityManifestChecksum: hash(blueprintAuthorityManifestBytes),
    },
  };
};

const git = (repository: string, args: readonly string[]): string =>
  execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: "pipe",
  });

const hash = (bytes: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const writeJson = (path: string, value: unknown): Buffer => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path, bytes);
  return bytes;
};

const createGeneratedCustomer = async (target: string) => {
  const fixture = candidateRelease({
    name: "No Network Support",
    outcome: "Export reviewed local support facts",
  });
  const command = createCustomerCreateComposition(
    fixture.source,
    buildSaasApplicationTargetPlan,
    fixture.replacements,
  );
  return command.run(
    [
      "create",
      target,
      "--name",
      "No Network Support",
      "--outcome",
      "Export reviewed local support facts",
      "--demo-only",
      "--write",
      "--json",
    ],
    fixture.root,
  );
};

const planPath =
  "tooling/agent-pack/src/privacy/no-network-plan.fixture.json" as const;
const interceptorPath = fileURLToPath(
  new URL("./runtimeNetworkInterceptor.mjs", import.meta.url),
);

function interceptedEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      `--import=${pathToFileURL(interceptorPath).href}`,
    ]
      .filter(Boolean)
      .join(" "),
    MAESTRO_NETWORK_AUDIT_PATH: attemptsPath,
  };
}

beforeEach(() => writeFileSync(attemptsPath, ""));

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
  if (candidateReleaseParent)
    rmSync(candidateReleaseParent, { recursive: true, force: true });
}, 120_000);

describe("privacy no-network conformance", () => {
  it("blocks a real outbound attempt in a spawned Node process", () => {
    const result = spawnSync(
      process.execPath,
      ["-e", 'require("node:http").get("http://198.51.100.1/")'],
      { env: interceptedEnvironment(), encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(readAttempts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "outbound-network-denied" }),
      ]),
    );
  });

  it.each(NO_NETWORK_FACTORY_CASES)(
    "runs $id with outbound networking denied",
    async (testCase) => {
      const argv = testCase.argv.map((argument) =>
        argument
          .replace("<CUSTOMER_TARGET>", customerTarget)
          .replace("<PLAN_PATH>", planPath),
      );
      const launch = networkIsolatedCommand("pnpm", ["maestro", "--", ...argv]);
      const result = await runProcess(launch.file, launch.args, {
        cwd: repositoryRoot,
        env: interceptedEnvironment(),
        timeoutMs: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      expect(
        result.error,
        `${testCase.id}\n${result.stdout}\n${result.stderr}`,
      ).toBeUndefined();
      expect(
        result.signal,
        `${testCase.id}\n${result.stdout}\n${result.stderr}`,
      ).toBeNull();
      if (testCase.command === "start") {
        expect(result.exitCode).toBe(0);
      } else {
        const structured = parseCliResult(result.stdout);
        expect(structured).toMatchObject({
          command: { id: testCase.command },
        });
        expect(structured.exitClass).not.toBe("invalidInvocation");
      }
      expect(
        externalSyscallLines(result.stderr),
        `${testCase.id}\n${result.stderr}`,
      ).toEqual([]);
      expect(readAttempts()).toEqual([]);
    },
    120_000,
  );

  it("previews the MCP support bundle with outbound networking denied and no write", async () => {
    const mcpTarget = join(fixtureRoot, "mcp-target");
    const launch = networkIsolatedCommand("pnpm", [
      "exec",
      "tsx",
      "apps/cli/src/factory/supportBundleMcpNoNetwork.fixture.ts",
      mcpTarget,
    ]);
    const result = await runProcess(launch.file, launch.args, {
      cwd: repositoryRoot,
      env: interceptedEnvironment(),
      timeoutMs: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(externalSyscallLines(result.stderr)).toEqual([]);
    expect(readAttempts()).toEqual([]);
    const responses = result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(responses.at(-1)).toMatchObject({
      id: 2,
      result: {
        structuredContent: {
          mutationPosture: "preview",
          data: { write: false, exportedBytes: null },
        },
      },
    });
    expect(existsSync(join(mcpTarget, ".maestro"))).toBe(false);
  }, 120_000);

  it("previews and exports a generated customer support bundle with no outbound attempts", async () => {
    const generatedTarget = join(fixtureRoot, "generated-support-customer");
    const created = await createGeneratedCustomer(generatedTarget);
    expect(created.exitCode, `${created.stdout}\n${created.stderr}`).toBe(0);
    const installed = spawnSync(
      "pnpm",
      ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      {
        cwd: generatedTarget,
        encoding: "utf8",
        timeout: 120_000,
      },
    );
    expect(installed.status, `${installed.stdout}\n${installed.stderr}`).toBe(
      0,
    );

    const preview = await traceGeneratedSupportBundle(generatedTarget, [
      "support-bundle",
      "--json",
    ]);
    const previewResult = JSON.parse(preview.stdout) as {
      readonly mutationPosture: string;
      readonly data: {
        readonly previewFingerprint: string;
        readonly write: boolean;
        readonly exportedBytes: number | null;
      };
    };
    expect(previewResult).toMatchObject({
      mutationPosture: "preview",
      data: { write: false, exportedBytes: null },
    });
    expect(existsSync(join(generatedTarget, ".maestro"))).toBe(false);

    const exported = await traceGeneratedSupportBundle(generatedTarget, [
      "support-bundle",
      "--write",
      "--json",
    ]);
    expect(JSON.parse(exported.stdout)).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: { write: true, exportedBytes: expect.any(Number) },
    });
    expect(readAttempts()).toEqual([]);
    expect(
      JSON.parse(
        readFileSync(
          join(generatedTarget, ".maestro/support/support-bundle.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({
      schemaVersion: 1,
      handling: { automaticUpload: false, containsSecrets: false },
    });
  }, 180_000);

  it("keeps explicit external exceptions purpose-specific and user initiated", () => {
    expect(NO_NETWORK_FACTORY_CASES.map(({ command }) => command)).toEqual([
      "create",
      "start",
      "add",
      "recipes",
      "doctor",
      "preflight",
      "verify",
      "check",
      "plan-check",
      "scaffold",
      "support-bundle",
    ]);
    const policy = JSON.parse(
      readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), "network-policy.json"),
        "utf8",
      ),
    ) as {
      externalOperations: readonly {
        id: string;
        userInitiated: boolean;
        purpose: string;
      }[];
    };
    expect(policy.externalOperations).toEqual([
      {
        id: "convex-mcp-inspect",
        userInitiated: true,
        purpose: "Inspect a selected personal Convex dev deployment.",
      },
      {
        id: "configured-provider-operation",
        userInitiated: true,
        purpose: "Send one requested operation to the selected provider.",
      },
      {
        id: "official-context-freshness",
        userInitiated: true,
        purpose: "Refresh pinned official framework context.",
      },
    ]);
  });
});

function readAttempts(): unknown[] {
  if (!existsSync(attemptsPath)) return [];
  return readFileSync(attemptsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function parseCliResult(stdout: string): Record<string, unknown> {
  const start = stdout.indexOf('{\n  "schemaVersion"');
  if (start < 0) throw new Error(`CLI result JSON is missing:\n${stdout}`);
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < stdout.length; index += 1) {
    const character = stdout[index];
    if (quoted) {
      if (escaped) escaped = false;
      else {
        escaped = character === "\\";
        if (character === '"') quoted = false;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0)
        return JSON.parse(stdout.slice(start, index + 1)) as Record<
          string,
          unknown
        >;
    }
  }
  throw new Error(`CLI result JSON is incomplete:\n${stdout}`);
}

function externalSyscallLines(trace: string): readonly string[] {
  return trace
    .split("\n")
    .filter(
      (line) =>
        /(?:connect|sendto|sendmsg|sendmmsg)\(/.test(line) &&
        /AF_INET6?/.test(line) &&
        !/sin_addr=inet_addr\("127\./.test(line) &&
        !/inet_pton\(AF_INET6, "::1"/.test(line),
    );
}

async function traceGeneratedSupportBundle(
  target: string,
  argv: readonly string[],
): Promise<Awaited<ReturnType<typeof runProcess>>> {
  const launch = networkIsolatedCommand("pnpm", [
    "--silent",
    "maestro",
    "--",
    ...argv,
  ]);
  const result = await runProcess(launch.file, launch.args, {
    cwd: target,
    env: interceptedEnvironment(),
    timeoutMs: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(externalSyscallLines(result.stderr), result.stderr).toEqual([]);
  expect(readAttempts()).toEqual([]);
  return result;
}

function networkIsolatedCommand(
  file: string,
  args: readonly string[],
): { readonly file: string; readonly args: readonly string[] } {
  if (process.platform === "darwin") {
    return {
      file: "/usr/bin/sandbox-exec",
      args: [
        "-p",
        "(version 1) (allow default) (deny network-outbound (remote ip))",
        file,
        ...args,
      ],
    };
  }
  return {
    file: "strace",
    args: ["-f", "-e", "trace=connect,sendto,sendmsg,sendmmsg", file, ...args],
  };
}

async function runProcess(
  file: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly stdin?: string;
    readonly timeoutMs: number;
    readonly maxBuffer: number;
  },
): Promise<{
  readonly error?: Error;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolveResult) => {
    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (options.stdin !== undefined) child.stdin?.end(options.stdin);
    let stdout = "";
    let stderr = "";
    let error: Error | undefined;
    const timeout = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs);
    const append = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > options.maxBuffer) {
        error = new Error("No-network command exceeded its output limit.");
        child.kill("SIGKILL");
      }
      return next;
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    child.once("error", (processError) => {
      error = processError;
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolveResult({
        ...(error === undefined ? {} : { error }),
        exitCode: code,
        signal,
        stdout,
        stderr,
      });
    });
  });
}
