import { execFile as nodeExecFile } from "node:child_process";
import { EvaluationError, type EvaluationHost } from "./contract.js";

export type HostCommandResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly unavailable: boolean;
};
export type HostCommand = {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
};
export type HostCommandExecutor = (
  input: HostCommand,
) => Promise<HostCommandResult>;
export type CodexTransportV1 = {
  readonly model: string;
  readonly provider_name: string;
  readonly base_url: string;
  readonly wire_api: "responses";
  readonly requires_openai_auth: true;
  readonly supports_websockets: true;
};
export type WalkingSkeletonHostAdapter = {
  readonly host: EvaluationHost;
  readonly isolation?: "workspace-offline" | "unverified";
  readonly preflight: (input: {
    readonly cwd: string;
    readonly hostHome: string;
    readonly sessionDir: string;
  }) => Promise<void>;
  readonly run: (input: {
    readonly cwd: string;
    readonly hostHome: string;
    readonly sessionDir: string;
    readonly prompt: string;
    readonly timeoutMs: number;
    readonly codexTransport?: CodexTransportV1;
    readonly networkAccess?: boolean;
  }) => Promise<HostCommandResult>;
};
export function claudeSandboxSettings(hostHome: string): string {
  return `${JSON.stringify(
    {
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
        filesystem: {
          denyRead: [hostHome],
          denyWrite: [hostHome],
        },
        network: { allowedDomains: [], deniedDomains: ["*"] },
      },
    },
    null,
    2,
  )}\n`;
}

const providerIdentifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const modelIdentifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
export function validateCodexTransport(value: unknown): CodexTransportV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidTransport();
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(candidate).sort();
  const expected = [
    "base_url",
    "model",
    "provider_name",
    "requires_openai_auth",
    "supports_websockets",
    "wire_api",
  ];
  if (
    JSON.stringify(keys) !== JSON.stringify(expected) ||
    typeof candidate.model !== "string" ||
    !modelIdentifier.test(candidate.model) ||
    typeof candidate.provider_name !== "string" ||
    !providerIdentifier.test(candidate.provider_name) ||
    typeof candidate.base_url !== "string" ||
    candidate.wire_api !== "responses" ||
    candidate.requires_openai_auth !== true ||
    candidate.supports_websockets !== true
  ) {
    return invalidTransport();
  }
  let url: URL;
  try {
    url = new URL(candidate.base_url);
  } catch {
    return invalidTransport();
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    return invalidTransport();
  }
  return candidate as CodexTransportV1;
}
function invalidTransport(): never {
  throw new EvaluationError(
    "EVAL_INVALID_ARGUMENT",
    "Codex transport must contain only valid model/provider identifiers, a loopback HTTP(S) base URL, responses wire API, OpenAI auth, and WebSocket support.",
  );
}
const codexTransportArgs = (value: CodexTransportV1): readonly string[] => {
  const transport = validateCodexTransport(value);
  const provider = transport.provider_name;
  return [
    "-c",
    `model=${JSON.stringify(transport.model)}`,
    "-c",
    `model_provider=${JSON.stringify(provider)}`,
    "-c",
    `model_providers.${provider}.name=${JSON.stringify(provider)}`,
    "-c",
    `model_providers.${provider}.base_url=${JSON.stringify(transport.base_url)}`,
    "-c",
    `model_providers.${provider}.wire_api="responses"`,
    "-c",
    `model_providers.${provider}.requires_openai_auth=true`,
    "-c",
    `model_providers.${provider}.supports_websockets=true`,
  ];
};

export function safeHostEnvironment(input: {
  readonly host: EvaluationHost;
  readonly hostHome: string;
  readonly sessionDir: string;
  readonly source?: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  const source = input.source ?? process.env;
  const path = source.PATH;
  if (!path) {
    throw new EvaluationError(
      "EVAL_HOST_EXECUTABLE_UNAVAILABLE",
      "PATH is unavailable for host execution.",
    );
  }
  return {
    PATH: path,
    HOME: input.sessionDir,
    TMPDIR: input.sessionDir,
    TMP: input.sessionDir,
    TEMP: input.sessionDir,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    CI: "1",
    NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    ...(input.host === "claude"
      ? { CLAUDE_CONFIG_DIR: input.hostHome }
      : { CODEX_HOME: input.hostHome }),
  };
}

export function createHostAdapter(
  host: EvaluationHost,
  execute: HostCommandExecutor = executeHostCommand,
): WalkingSkeletonHostAdapter {
  const command = host === "claude" ? "claude" : "codex";
  const environment = (hostHome: string, sessionDir: string) =>
    safeHostEnvironment({ host, hostHome, sessionDir });
  return {
    host,
    isolation: "workspace-offline",
    preflight: async ({ cwd, hostHome, sessionDir }) => {
      const env = environment(hostHome, sessionDir);
      const version = await execute({
        command,
        args: ["--version"],
        cwd,
        env,
        timeoutMs: 10_000,
      });
      if (version.unavailable || version.exitCode !== 0) {
        throw new EvaluationError(
          "EVAL_HOST_EXECUTABLE_UNAVAILABLE",
          `${command} is not available for the ${host} evaluation.`,
        );
      }
      const auth = await execute({
        command,
        args: host === "claude" ? ["auth", "status"] : ["login", "status"],
        cwd,
        env,
        timeoutMs: 10_000,
      });
      if (
        auth.exitCode !== 0 ||
        /["']?loggedIn["']?\s*[:=]\s*false/iu.test(
          `${auth.stdout}\n${auth.stderr}`,
        )
      ) {
        throw new EvaluationError(
          "EVAL_HOST_AUTH_REQUIRED",
          `${host} authentication is unavailable; authenticate outside the harness and rerun.`,
        );
      }
      if (host === "claude") {
        for (const [dependency, args] of [
          ["bwrap", ["--version"]],
          ["socat", ["-V"]],
        ] as const) {
          const sandboxDependency = await execute({
            command: dependency,
            args,
            cwd,
            env,
            timeoutMs: 10_000,
          });
          if (
            sandboxDependency.unavailable ||
            sandboxDependency.exitCode !== 0
          ) {
            throw new EvaluationError(
              "EVAL_HOST_ISOLATION_UNAVAILABLE",
              `Claude sandbox dependency is unavailable: ${dependency}.`,
            );
          }
        }
      }
    },
    run: ({
      cwd,
      hostHome,
      sessionDir,
      prompt,
      timeoutMs,
      codexTransport,
      networkAccess,
    }) =>
      execute({
        command,
        args:
          host === "claude"
            ? [
                "-p",
                prompt,
                "--setting-sources",
                "project",
                "--tools",
                "Bash",
                "--allowedTools",
                "Bash",
                "--disallowedTools",
                "WebFetch,WebSearch,Agent,Task",
                "--output-format",
                "json",
                "--strict-mcp-config",
                "--mcp-config",
                `${sessionDir}/empty-mcp.json`,
                "--settings",
                `${sessionDir}/claude-settings.json`,
              ]
            : [
                "exec",
                "--ephemeral",
                "--ignore-user-config",
                "--ignore-rules",
                "-c",
                "mcp_servers={}",
                "-c",
                `sandbox_workspace_write.network_access=${String(networkAccess ?? true)}`,
                ...(codexTransport ? codexTransportArgs(codexTransport) : []),
                "-c",
                'model_reasoning_effort="medium"',
                "--json",
                "--sandbox",
                "workspace-write",
                "-C",
                cwd,
                prompt,
              ],
        cwd,
        env: environment(hostHome, sessionDir),
        timeoutMs,
      }),
  };
}

export function executeHostCommand(
  input: HostCommand,
): Promise<HostCommandResult> {
  return new Promise((resolveResult) => {
    const child = nodeExecFile(
      input.command,
      [...input.args],
      {
        cwd: input.cwd,
        env: input.env,
        timeout: input.timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code = error && "code" in error ? error.code : null;
        resolveResult({
          exitCode: error === null ? 0 : typeof code === "number" ? code : null,
          stdout: String(stdout),
          stderr: String(stderr),
          unavailable: code === "ENOENT",
        });
      },
    );
    child.stdin?.end();
  });
}
