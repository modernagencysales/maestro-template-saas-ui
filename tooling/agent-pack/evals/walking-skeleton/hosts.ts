import { execFile as nodeExecFile } from "node:child_process";
import { EvaluationError, type EvaluationHost } from "./contract.js";

export type HostCommandResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly unavailable: boolean;
};

export type HostCommandExecutor = (input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
}) => Promise<HostCommandResult>;

export type WalkingSkeletonHostAdapter = {
  readonly host: EvaluationHost;
  readonly preflight: (input: {
    readonly cwd: string;
    readonly hostHome: string;
  }) => Promise<void>;
  readonly run: (input: {
    readonly cwd: string;
    readonly hostHome: string;
    readonly prompt: string;
    readonly timeoutMs: number;
  }) => Promise<HostCommandResult>;
};

export function createHostAdapter(
  host: EvaluationHost,
  execute: HostCommandExecutor = executeHostCommand,
): WalkingSkeletonHostAdapter {
  const command = host === "claude" ? "claude" : "codex";
  const environment = (hostHome: string): NodeJS.ProcessEnv => ({
    ...process.env,
    ...(host === "claude"
      ? { CLAUDE_CONFIG_DIR: hostHome }
      : { CODEX_HOME: hostHome }),
  });
  return {
    host,
    preflight: async ({ cwd, hostHome }) => {
      const version = await execute({
        command,
        args: ["--version"],
        cwd,
        env: environment(hostHome),
        timeoutMs: 10_000,
      });
      if (version.unavailable) {
        throw new EvaluationError(
          "EVAL_HOST_EXECUTABLE_UNAVAILABLE",
          `${command} is not available for the ${host} evaluation.`,
        );
      }
      if (version.exitCode !== 0) {
        throw new EvaluationError(
          "EVAL_HOST_EXECUTABLE_UNAVAILABLE",
          `${command} could not report its version.`,
        );
      }
      const auth = await execute({
        command,
        args: host === "claude" ? ["auth", "status"] : ["login", "status"],
        cwd,
        env: environment(hostHome),
        timeoutMs: 10_000,
      });
      if (auth.exitCode !== 0) {
        throw new EvaluationError(
          "EVAL_HOST_AUTH_REQUIRED",
          `${host} authentication is unavailable in the isolated host home.`,
        );
      }
    },
    run: ({ cwd, hostHome, prompt, timeoutMs }) =>
      execute({
        command,
        args:
          host === "claude"
            ? ["-p", prompt, "--output-format", "json"]
            : [
                "exec",
                "--json",
                "--sandbox",
                "workspace-write",
                "-C",
                cwd,
                prompt,
              ],
        cwd,
        env: environment(hostHome),
        timeoutMs,
      }),
  };
}

export function executeHostCommand(input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
}): Promise<HostCommandResult> {
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
        const unavailable = code === "ENOENT";
        resolveResult({
          exitCode: error === null ? 0 : typeof code === "number" ? code : null,
          stdout: String(stdout),
          stderr: String(stderr),
          unavailable,
        });
      },
    );
  });
}
