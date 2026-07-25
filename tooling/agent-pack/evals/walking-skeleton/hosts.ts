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
export type WalkingSkeletonHostAdapter = {
  readonly host: EvaluationHost;
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
  }) => Promise<HostCommandResult>;
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
    },
    run: ({ cwd, hostHome, sessionDir, prompt, timeoutMs }) =>
      execute({
        command,
        args:
          host === "claude"
            ? [
                "-p",
                prompt,
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
                "-c",
                "mcp_servers={}",
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
    nodeExecFile(
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
  });
}
