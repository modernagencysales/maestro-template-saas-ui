import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NO_NETWORK_FACTORY_CASES } from "./networkPolicy.js";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "maestro-no-network-"));
const attemptsPath = join(fixtureRoot, "attempts.ndjson");
const customerTarget = join(fixtureRoot, "customer-app");
let taggedReleaseParent: string | undefined;
let taggedReleaseRoot: string | undefined;
const taggedRepository = (): string => {
  if (taggedReleaseRoot) return taggedReleaseRoot;
  taggedReleaseParent = mkdtempSync(join(tmpdir(), "maestro-tagged-release-"));
  taggedReleaseRoot = join(taggedReleaseParent, "release");
  execFileSync(
    "git",
    ["clone", "--quiet", "--shared", repositoryRoot, taggedReleaseRoot],
    { stdio: "pipe" },
  );
  execFileSync(
    "git",
    [
      "-C",
      taggedReleaseRoot,
      "tag",
      "--force",
      "maestro-template-v0.2.0-alpha.1",
      "HEAD",
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    "pnpm",
    ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: taggedReleaseRoot, stdio: "pipe", timeout: 120_000 },
  );
  return taggedReleaseRoot;
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
  if (taggedReleaseParent)
    rmSync(taggedReleaseParent, { recursive: true, force: true });
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
      const result = await runProcess(
        "strace",
        [
          "-f",
          "-e",
          "trace=connect,sendto,sendmsg,sendmmsg",
          "pnpm",
          "maestro",
          "--",
          ...argv,
        ],
        {
          cwd: repositoryRoot,
          env: interceptedEnvironment(),
          timeoutMs: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
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
    const result = await runProcess(
      "strace",
      [
        "-f",
        "-e",
        "trace=connect,sendto,sendmsg,sendmmsg",
        "pnpm",
        "exec",
        "tsx",
        "apps/cli/src/factory/supportBundleMcpNoNetwork.fixture.ts",
        mcpTarget,
      ],
      {
        cwd: repositoryRoot,
        env: interceptedEnvironment(),
        timeoutMs: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
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
    const created = spawnSync(
      "pnpm",
      [
        "maestro",
        "--",
        "create",
        generatedTarget,
        "--name",
        "No Network Support",
        "--outcome",
        "Export reviewed local support facts",
        "--demo-only",
        "--write",
        "--privacy-reviewed",
        "--json",
      ],
      {
        cwd: taggedRepository(),
        encoding: "utf8",
        timeout: 120_000,
      },
    );
    expect(created.status, `${created.stdout}\n${created.stderr}`).toBe(0);
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
      "--preview-fingerprint",
      previewResult.data.previewFingerprint,
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
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
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
  const result = await runProcess(
    "strace",
    [
      "-f",
      "-e",
      "trace=connect,sendto,sendmsg,sendmmsg",
      "pnpm",
      "--silent",
      "maestro",
      "--",
      ...argv,
    ],
    {
      cwd: target,
      env: interceptedEnvironment(),
      timeoutMs: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(externalSyscallLines(result.stderr), result.stderr).toEqual([]);
  expect(readAttempts()).toEqual([]);
  return result;
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
