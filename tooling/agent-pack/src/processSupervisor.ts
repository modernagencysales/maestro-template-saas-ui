import { spawn } from "node:child_process";

export type StartProcessSpec = {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly environment?: {
    readonly remove: readonly string[];
    readonly set: Readonly<Record<string, string>>;
  };
};
export type ProcessCompletion = {
  readonly code: number | null;
  readonly signal: string | null;
};
export type ProcessSupervisionResult =
  | { readonly kind: "user-signal"; readonly signal: NodeJS.Signals }
  | { readonly kind: "child-exit"; readonly completion: ProcessCompletion }
  | { readonly kind: "readiness-timeout" }
  | { readonly kind: "readiness-failed" }
  | { readonly kind: "spawn-failed" };
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
    readonly readiness: {
      readonly wait: (signal: AbortSignal) => Promise<boolean>;
      readonly onReady: () => void;
    };
  },
): Promise<ProcessSupervisionResult> {
  const children: ManagedProcess[] = [];
  let forwardedSignal: NodeJS.Signals | undefined;
  let resolveUserSignal!: (signal: NodeJS.Signals) => void;
  const userSignal = new Promise<NodeJS.Signals>((resolve) => {
    resolveUserSignal = resolve;
  });
  const terminateAll = async (signal: NodeJS.Signals): Promise<void> => {
    await Promise.allSettled(children.map((child) => child.terminate(signal)));
  };
  const unsubscribe = dependencies.signals.subscribe((signal) => {
    if (forwardedSignal !== undefined) return;
    forwardedSignal = signal;
    resolveUserSignal(signal);
    void terminateAll(signal);
  });
  try {
    for (const spec of specs) {
      if (forwardedSignal !== undefined) break;
      children.push(
        await dependencies.spawner.spawn(spec, (_stream, line) => {
          dependencies.log(`[${spec.id}] ${redactStartLog(line)}`);
        }),
      );
    }
    if (forwardedSignal !== undefined) {
      await terminateAll(forwardedSignal);
      await settleChildren(children);
      return { kind: "user-signal", signal: forwardedSignal };
    }
    const childExit = Promise.race(
      children.map((child) => child.completion),
    ).then((completion) => ({ kind: "child-exit", completion }) as const);
    const signalEvent = userSignal.then(
      (signal) => ({ kind: "user-signal", signal }) as const,
    );
    const readinessAbort = new AbortController();
    const readiness = dependencies.readiness
      .wait(readinessAbort.signal)
      .then((ready) =>
        ready
          ? ({ kind: "ready" } as const)
          : ({ kind: "readiness-timeout" } as const),
      )
      .catch(() => ({ kind: "readiness-failed" }) as const);
    const admission = await Promise.race([childExit, signalEvent, readiness]);
    if (admission.kind !== "ready") {
      readinessAbort.abort();
      await terminateAll(
        admission.kind === "user-signal" ? admission.signal : "SIGTERM",
      );
      await settleChildren(children);
      return admission;
    }
    dependencies.readiness.onReady();
    const outcome = await Promise.race([childExit, signalEvent]);
    readinessAbort.abort();
    await terminateAll(
      outcome.kind === "user-signal" ? outcome.signal : "SIGTERM",
    );
    await settleChildren(children);
    return outcome;
  } catch {
    await terminateAll("SIGTERM");
    await settleChildren(children);
    return { kind: "spawn-failed" };
  } finally {
    unsubscribe();
  }
}

async function settleChildren(
  children: readonly ManagedProcess[],
): Promise<void> {
  await Promise.allSettled(children.map((child) => child.completion));
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

export function createNodeProcessSpawner(
  environment: () => NodeJS.ProcessEnv,
): ProcessSpawner {
  return {
    spawn: async (spec, output) => {
      const child = spawn(spec.command, [...spec.args], {
        cwd: spec.cwd,
        env: projectProcessEnvironment(environment(), spec.environment),
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
        detached: process.platform !== "win32",
      });
      const started = new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      const completion = new Promise<ProcessCompletion>((resolve) => {
        child.once("error", () => resolve({ code: null, signal: null }));
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
      pipeLines(child.stdout, (line) => output("stdout", line));
      pipeLines(child.stderr, (line) => output("stderr", line));
      await started;
      return {
        completion,
        terminate: async (signal) => {
          if (child.exitCode === null && child.signalCode === null) {
            signalProcessTree(child.pid, signal);
            const stopped = await settlesWithin(completion, 2_000);
            if (
              !stopped &&
              child.exitCode === null &&
              child.signalCode === null
            ) {
              signalProcessTree(child.pid, "SIGKILL");
            }
          }
          await completion.catch(() => undefined);
        },
      };
    },
  };
}

export function projectProcessEnvironment(
  base: NodeJS.ProcessEnv,
  projection: StartProcessSpec["environment"],
): NodeJS.ProcessEnv {
  const child = { ...base };
  if (projection === undefined) return child;
  for (const name of projection.remove) delete child[name];
  return Object.assign(child, projection.set);
}

function signalProcessTree(
  pid: number | undefined,
  signal: NodeJS.Signals,
): void {
  if (pid === undefined) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch {
    // The process may have exited between the state check and signal.
  }
}

async function settlesWithin(
  completion: Promise<ProcessCompletion>,
  timeoutMs: number,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
  });
  const result = await Promise.race([
    completion.then(
      () => true as const,
      () => true as const,
    ),
    timeout,
  ]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

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
