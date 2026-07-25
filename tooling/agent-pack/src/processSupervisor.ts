import { spawn } from "node:child_process";

export type StartProcessSpec = {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
};
export type ProcessCompletion = {
  readonly code: number | null;
  readonly signal: string | null;
};
export type ManagedProcess = {
  readonly completion: Promise<ProcessCompletion>;
  readonly terminate: (signal: NodeJS.Signals) => Promise<void>;
};
export type ProcessSpawner = {
  readonly spawn: (
    spec: StartProcessSpec,
    output: (stream: "stdout" | "stderr", line: string) => void,
  ) => Promise<ManagedProcess>;
};
export type StartSignalBoundary = {
  readonly subscribe: (handler: (signal: NodeJS.Signals) => void) => () => void;
};

export async function superviseProcesses(
  specs: readonly StartProcessSpec[],
  dependencies: {
    readonly spawner: ProcessSpawner;
    readonly signals: StartSignalBoundary;
    readonly log: (line: string) => void;
  },
): Promise<ProcessCompletion> {
  const children: ManagedProcess[] = [];
  let forwardedSignal: NodeJS.Signals | undefined;
  const terminateAll = async (signal: NodeJS.Signals): Promise<void> => {
    await Promise.allSettled(children.map((child) => child.terminate(signal)));
  };
  const unsubscribe = dependencies.signals.subscribe((signal) => {
    forwardedSignal = signal;
    void terminateAll(signal);
  });
  try {
    for (const spec of specs) {
      children.push(
        await dependencies.spawner.spawn(spec, (_stream, line) => {
          dependencies.log(`[${spec.id}] ${redactStartLog(line)}`);
        }),
      );
    }
    const first = await Promise.race(children.map((child) => child.completion));
    await terminateAll(forwardedSignal ?? "SIGTERM");
    await Promise.allSettled(children.map((child) => child.completion));
    return forwardedSignal === undefined
      ? first
      : { code: null, signal: forwardedSignal };
  } catch (error) {
    await terminateAll("SIGTERM");
    await Promise.allSettled(children.map((child) => child.completion));
    throw error;
  } finally {
    unsubscribe();
  }
}

export function redactStartLog(line: string): string {
  return line
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(
      /\b((?:[A-Z][A-Z0-9_]*(?:_KEY|_TOKEN|_SECRET|_PASSWORD))|KEY|TOKEN|SECRET|PASSWORD)=\S+/g,
      "$1=[REDACTED]",
    );
}

export const nodeStartSignalBoundary: StartSignalBoundary = {
  subscribe: (handler) => {
    const onInterrupt = () => handler("SIGINT");
    const onTerminate = () => handler("SIGTERM");
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    return () => {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
    };
  },
};

export const nodeProcessSpawner: ProcessSpawner = {
  spawn: async (spec, output) => {
    const child = spawn(spec.command, [...spec.args], {
      cwd: spec.cwd,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
      shell: false,
    });
    const completion = new Promise<ProcessCompletion>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    pipeLines(child.stdout, (line) => output("stdout", line));
    pipeLines(child.stderr, (line) => output("stderr", line));
    return {
      completion,
      terminate: async (signal) => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill(signal);
        }
        await completion.catch(() => undefined);
      },
    };
  },
};

function pipeLines(
  stream: NodeJS.ReadableStream | null,
  output: (line: string) => void,
): void {
  if (stream === null) return;
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) output(line);
  });
  stream.on("end", () => {
    if (pending !== "") output(pending);
  });
}
