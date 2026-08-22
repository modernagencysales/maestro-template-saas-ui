import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { isDirectTemporaryPath } from "./temporaryPath.js";

export type NativeHostName = "claude-code" | "codex";

export type NativeHostFixture = {
  readonly host: NativeHostName;
  readonly root: string;
  readonly homeDir: string;
  readonly hostConfigDir: string;
  readonly projectDir: string;
  readonly tempDir: string;
  readonly xdgConfigDir: string;
  readonly xdgDataDir: string;
  readonly xdgCacheDir: string;
};

export type NativeHostCommandResult = {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly networkAccess: "none" | "unchecked";
  readonly environmentKeys: readonly string[];
};

export type NativeMcpHandshakeResult = {
  readonly initialize: Readonly<Record<string, unknown>>;
  readonly tools: readonly Readonly<Record<string, unknown>>[];
  readonly process: NativeHostCommandResult;
};

export type NativeHostBinaryProbe =
  | {
      readonly kind: "available";
      readonly binary: string;
      readonly version: string;
    }
  | { readonly kind: "missing-binary"; readonly binary: string };

const COMMAND_TIMEOUT_MS = 30_000;

export async function createNativeHostFixture(
  host: NativeHostName,
): Promise<NativeHostFixture> {
  const token = host === "claude-code" ? "nc" : "nx";
  const root = await mkdtemp(join(tmpdir(), `maestro-${token}-`));
  const fixture: NativeHostFixture = {
    host,
    root,
    homeDir: join(root, "home"),
    hostConfigDir: join(root, "host-config"),
    projectDir: join(root, "project"),
    tempDir: join(root, "runtime-tmp"),
    xdgConfigDir: join(root, "xdg-config"),
    xdgDataDir: join(root, "xdg-data"),
    xdgCacheDir: join(root, "xdg-cache"),
  };
  await assertFixtureRoot(fixture);
  await Promise.all(mutableDirectories(fixture).map((path) => mkdir(path)));
  return fixture;
}

export async function probeNativeHostBinary(
  fixture: NativeHostFixture,
): Promise<NativeHostBinaryProbe> {
  const binary = nativeBinary(fixture.host);
  try {
    const result = await runNativeHostCommand(fixture, ["--version"]);
    if (result.exitCode !== 0) {
      throw new Error(
        `${result.command} failed while probing the native binary: ${result.stderr}`,
      );
    }
    return {
      kind: "available",
      binary,
      version: result.stdout.trim(),
    };
  } catch (error) {
    if (error instanceof MissingNativeHostBinaryError) {
      return { kind: "missing-binary", binary };
    }
    throw error;
  }
}

export async function runNativeHostCommand(
  fixture: NativeHostFixture,
  args: readonly string[],
  options: {
    readonly cwd?: string;
    readonly networkAccess?: "forbid";
  } = {},
): Promise<NativeHostCommandResult> {
  await assertFixtureRoot(fixture);
  const binary = nativeBinary(fixture.host);
  const cwd = options.cwd ?? fixture.projectDir;
  return runIsolatedCommand(fixture, binary, args, {
    cwd,
    ...(options.networkAccess === undefined
      ? {}
      : { networkAccess: options.networkAccess }),
  });
}

export async function runNativeMcpHandshake(
  fixture: NativeHostFixture,
  rawConfig: unknown,
): Promise<NativeMcpHandshakeResult> {
  await assertFixtureRoot(fixture);
  const transport = parseMcpStdioTransport(rawConfig);
  const process = await runIsolatedCommand(
    fixture,
    transport.command,
    transport.args,
    {
      cwd: transport.cwd ?? fixture.projectDir,
      input: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            clientInfo: {
              name: "maestro-native-codex-acceptance",
              version: "1.0.0",
            },
            capabilities: {},
          },
        },
        {
          jsonrpc: "2.0",
          method: "notifications/initialized",
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        },
      ]
        .map((frame) => JSON.stringify(frame))
        .join("\n")
        .concat("\n"),
      networkAccess: "forbid",
    },
  );
  if (process.exitCode !== 0) {
    throw new Error(
      `${process.command} failed during MCP handshake\nstdout:\n${process.stdout}\nstderr:\n${process.stderr}`,
    );
  }
  const responses = parseMcpResponses(process.stdout);
  const initialize = responseById(responses, 1, "initialize");
  const toolList = responseById(responses, 2, "tools/list");
  const result = record(toolList.result);
  if (!Array.isArray(result.tools) || !result.tools.every(isRecord)) {
    throw new Error(
      "Maestro MCP tools/list returned a malformed tool inventory",
    );
  }
  return { initialize, tools: result.tools, process };
}

async function runIsolatedCommand(
  fixture: NativeHostFixture,
  executable: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly input?: string;
    readonly networkAccess?: "forbid";
  },
): Promise<NativeHostCommandResult> {
  const command = [executable, ...args].map(renderArgument).join(" ");
  const environment = isolatedEnvironment(fixture);
  const packageManagerEntrypoint =
    executable === "pnpm" ? await localPnpmEntrypoint() : undefined;
  const directExecutable =
    packageManagerEntrypoint === undefined ? executable : process.execPath;
  const directArgs =
    packageManagerEntrypoint === undefined
      ? [...args]
      : [packageManagerEntrypoint, ...args];
  const networkInterceptor =
    options.networkAccess === "forbid"
      ? process.platform === "darwin"
        ? "sandbox-exec"
        : "strace"
      : undefined;
  const tracePath =
    networkInterceptor === "strace"
      ? join(fixture.root, `.network-trace-${randomUUID()}`)
      : undefined;
  let launchExecutable = directExecutable;
  let launchArgs = directArgs;
  if (networkInterceptor === "sandbox-exec") {
    launchExecutable = "/usr/bin/sandbox-exec";
    launchArgs = [
      "-p",
      "(version 1) (allow default) (deny network-outbound (remote ip))",
      directExecutable,
      ...directArgs,
    ];
  } else if (networkInterceptor === "strace") {
    if (tracePath === undefined) {
      throw new Error("strace network isolation requires a trace path");
    }
    launchExecutable = "strace";
    launchArgs = [
      "-f",
      "-qq",
      "-e",
      "trace=connect,sendto,sendmsg,sendmmsg",
      "-o",
      tracePath,
      "--",
      directExecutable,
      ...directArgs,
    ];
  }

  return await new Promise((resolveResult, reject) => {
    const child = spawn(launchExecutable, launchArgs, {
      cwd: options.cwd,
      env: environment,
      shell: false,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (child.stdout === null || child.stderr === null) {
      child.kill("SIGKILL");
      reject(new Error(`${command} did not expose protocol output streams`));
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    if (options.input !== undefined) {
      if (child.stdin === null) {
        child.kill("SIGKILL");
        reject(new Error(`${command} did not expose a protocol input stream`));
        return;
      }
      child.stdin.end(options.input);
    }
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, COMMAND_TIMEOUT_MS);

    child.once("error", (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      void cleanupTrace(tracePath).finally(() => {
        if (errorCode(error) !== "ENOENT") reject(error);
        else if (networkInterceptor !== undefined)
          reject(new MissingNetworkInterceptorError(networkInterceptor));
        else reject(new MissingNativeHostBinaryError(executable));
      });
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      void (async () => {
        try {
          if (tracePath !== undefined) {
            const trace = await readFile(tracePath, "utf8");
            assertNoExternalNetwork(trace, command);
          }
          resolveResult({
            command,
            args: [...args],
            cwd: options.cwd,
            exitCode: timedOut ? 124 : (code ?? 1),
            stdout,
            stderr: timedOut
              ? `${stderr}\ncommand timed out after ${COMMAND_TIMEOUT_MS}ms\n`
              : stderr,
            networkAccess:
              networkInterceptor === undefined ? "unchecked" : "none",
            environmentKeys: Object.keys(environment).sort(),
          });
        } catch (error) {
          reject(error);
        } finally {
          await cleanupTrace(tracePath);
        }
      })();
    });
  });
}

async function localPnpmEntrypoint(): Promise<string | undefined> {
  if (
    process.env.npm_execpath !== undefined &&
    isAbsolute(process.env.npm_execpath)
  ) {
    return process.env.npm_execpath;
  }
  const version = /^pnpm\/([^\s]+)/u.exec(
    process.env.npm_config_user_agent ?? "",
  )?.[1];
  if (version === undefined) return undefined;
  const cacheRoot =
    process.env.COREPACK_HOME ??
    join(
      process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
      "node/corepack",
    );
  const candidate = join(cacheRoot, "v1/pnpm", version, "bin/pnpm.cjs");
  return (await exists(candidate)) ? candidate : undefined;
}

export async function listNativeHostFixtureFiles(
  fixture: NativeHostFixture,
): Promise<readonly string[]> {
  await assertFixtureRoot(fixture);
  return (await filesUnder(fixture.root)).map((path) =>
    relative(fixture.root, path).replaceAll("\\", "/"),
  );
}

export async function restoreNativeHostFixture(
  fixture: NativeHostFixture,
): Promise<void> {
  await assertFixtureRoot(fixture);
  for (const path of mutableDirectories(fixture)) {
    await assertDirectFixtureChild(fixture, path);
    await rm(path, { recursive: true, force: true });
    await mkdir(path);
  }
}

export async function destroyNativeHostFixture(
  fixture: NativeHostFixture,
): Promise<void> {
  if (!(await exists(fixture.root))) return;
  await assertFixtureRoot(fixture);
  await rm(fixture.root, { recursive: true, force: true });
  if (await exists(fixture.root)) {
    throw new Error(`native host fixture teardown failed: ${fixture.root}`);
  }
}

function isolatedEnvironment(fixture: NativeHostFixture): NodeJS.ProcessEnv {
  const path = process.env.PATH;
  if (path === undefined || path.length === 0) {
    throw new Error("PATH is required to invoke a native host binary");
  }
  const env: NodeJS.ProcessEnv = {
    PATH: path,
    HOME: fixture.homeDir,
    TMPDIR: fixture.tempDir,
    XDG_CONFIG_HOME: fixture.xdgConfigDir,
    XDG_DATA_HOME: fixture.xdgDataDir,
    XDG_CACHE_HOME: fixture.xdgCacheDir,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    TERM: "dumb",
    CI: "1",
    NO_COLOR: "1",
  };
  if (fixture.host === "claude-code") {
    env.CLAUDE_CONFIG_DIR = fixture.hostConfigDir;
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
    env.DISABLE_AUTOUPDATER = "1";
    env.HTTPS_PROXY = "http://127.0.0.1:0";
  } else {
    env.CODEX_HOME = fixture.hostConfigDir;
  }
  return env;
}

async function assertFixtureRoot(fixture: NativeHostFixture): Promise<void> {
  const token = fixture.host === "claude-code" ? "nc" : "nx";
  const resolved = resolve(fixture.root);
  const expectedPrefix = `maestro-${token}-`;
  if (!basename(resolved).startsWith(expectedPrefix)) {
    throw new Error(
      "native host fixture must use the validated temporary prefix",
    );
  }
  if (!(await isDirectTemporaryPath(resolved))) {
    throw new Error(
      "native host fixture must be a direct, non-symlink temp path",
    );
  }
  if ((await lstat(resolved)).isSymbolicLink()) {
    throw new Error("native host fixture root must not be a symlink");
  }
}

async function assertDirectFixtureChild(
  fixture: NativeHostFixture,
  path: string,
): Promise<void> {
  const relativePath = relative(fixture.root, resolve(path));
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    relativePath.includes("/") ||
    relativePath.includes("\\")
  ) {
    throw new Error(`native host fixture child is unsafe: ${path}`);
  }
  if ((await lstat(path)).isSymbolicLink()) {
    throw new Error(`native host fixture child must not be a symlink: ${path}`);
  }
}

function mutableDirectories(fixture: NativeHostFixture): readonly string[] {
  return [
    fixture.homeDir,
    fixture.hostConfigDir,
    fixture.projectDir,
    fixture.tempDir,
    fixture.xdgConfigDir,
    fixture.xdgDataDir,
    fixture.xdgCacheDir,
  ];
}

function nativeBinary(host: NativeHostName): "claude" | "codex" {
  return host === "claude-code" ? "claude" : "codex";
}

function renderArgument(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value);
}

function parseMcpStdioTransport(rawConfig: unknown): {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string | null;
} {
  if (!isRecord(rawConfig) || rawConfig.enabled !== true) {
    throw new Error("Maestro MCP configuration is missing or disabled");
  }
  const transport = record(rawConfig.transport);
  if (
    rawConfig.name !== "maestro" ||
    rawConfig.disabled_reason !== null ||
    transport.type !== "stdio" ||
    typeof transport.command !== "string" ||
    transport.command.length === 0 ||
    !Array.isArray(transport.args) ||
    !transport.args.every((argument) => typeof argument === "string") ||
    (transport.cwd !== null && typeof transport.cwd !== "string") ||
    (transport.cwd !== null && transport.cwd.includes("${")) ||
    (transport.env !== null && transport.env !== undefined) ||
    !Array.isArray(transport.env_vars) ||
    transport.env_vars.length > 0
  ) {
    throw new Error("Maestro MCP stdio configuration is malformed or unsafe");
  }
  return {
    command: transport.command,
    args: transport.args,
    cwd: transport.cwd,
  };
}

function parseMcpResponses(
  stdout: string,
): readonly Readonly<Record<string, unknown>>[] {
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  try {
    const responses = lines.map((line) => JSON.parse(line) as unknown);
    if (!responses.every(isRecord)) throw new Error("not an object");
    return responses;
  } catch (error) {
    throw new Error(
      `Maestro MCP emitted non-protocol stdout: ${String(error)}`,
    );
  }
}

function responseById(
  responses: readonly Readonly<Record<string, unknown>>[],
  id: number,
  method: string,
): Readonly<Record<string, unknown>> {
  const response = responses.find((candidate) => candidate.id === id);
  if (
    response === undefined ||
    response.jsonrpc !== "2.0" ||
    !("result" in response) ||
    "error" in response
  ) {
    throw new Error(`Maestro MCP did not complete ${method}`);
  }
  return response;
}

function assertNoExternalNetwork(trace: string, command: string): void {
  const attempts = trace
    .split("\n")
    .filter(
      (line) =>
        /(?:connect|sendto|sendmsg|sendmmsg)\(/.test(line) &&
        /AF_INET6?/.test(line) &&
        !/sin_addr=inet_addr\("127\./.test(line) &&
        !/inet_pton\(AF_INET6, "::1"/.test(line),
    );
  if (attempts.length > 0) {
    throw new Error(
      `${command} attempted outbound network access:\n${attempts.join("\n")}`,
    );
  }
}

async function cleanupTrace(path: string | undefined): Promise<void> {
  if (path !== undefined) await rm(path, { force: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

async function filesUnder(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}

function errorCode(error: unknown): unknown {
  if (error === null || typeof error !== "object") return undefined;
  return Object.fromEntries(Object.entries(error)).code;
}

class MissingNativeHostBinaryError extends Error {
  constructor(binary: string) {
    super(`missing native host binary: ${binary}`);
    this.name = "MissingNativeHostBinaryError";
  }
}

class MissingNetworkInterceptorError extends Error {
  constructor(interceptor: string) {
    super(`missing required native network interceptor: ${interceptor}`);
    this.name = "MissingNetworkInterceptorError";
  }
}
