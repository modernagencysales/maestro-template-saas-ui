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
import { spawn, spawnSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NO_NETWORK_FACTORY_CASES } from "./networkPolicy.js";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "maestro-no-network-"));
const attemptsPath = join(fixtureRoot, "attempts.ndjson");
const customerTarget = join(fixtureRoot, "customer-app");
const planPath = join(fixtureRoot, "plan.json");
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

beforeAll(() => {
  writeFileSync(
    planPath,
    `${JSON.stringify({ feature: "privacy-proof", slices: [], allTaskRefs: [] })}\n`,
  );
});

beforeEach(() => writeFileSync(attemptsPath, ""));

afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

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
      expect(
        externalSyscallLines(result.stderr),
        `${testCase.id}\n${result.stderr}`,
      ).toEqual([]);
      expect(readAttempts()).toEqual([]);
    },
    120_000,
  );

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

async function runProcess(
  file: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly timeoutMs: number;
    readonly maxBuffer: number;
  },
): Promise<{
  readonly error?: Error;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolveResult) => {
    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
    child.once("close", (_code, signal) => {
      clearTimeout(timeout);
      resolveResult({
        ...(error === undefined ? {} : { error }),
        signal,
        stdout,
        stderr,
      });
    });
  });
}
