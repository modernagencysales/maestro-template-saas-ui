import { describe, expect, it, vi } from "vitest";
import {
  createNodeProcessSpawner,
  processTreeSignalRequest,
  redactStartLog,
  superviseProcesses,
  type ManagedProcess,
  type ProcessSpawner,
  type StartProcessSpec,
} from "./processSupervisor.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => (resolve = done)), resolve };
}

function fixtureSpawner() {
  const children: Array<{
    spec: StartProcessSpec;
    child: ManagedProcess;
    finish: ReturnType<
      typeof deferred<{ code: number | null; signal: string | null }>
    >;
  }> = [];
  const spawn: ProcessSpawner["spawn"] = vi.fn(async (spec, output) => {
    const finish = deferred<{ code: number | null; signal: string | null }>();
    const child = {
      completion: finish.promise,
      terminate: vi.fn(async (signal: string) => {
        finish.resolve({ code: null, signal });
      }),
    };
    children.push({ spec, child, finish });
    output("stdout", "ready TOKEN=super-secret");
    return child;
  });
  return { children, spawner: { spawn } satisfies ProcessSpawner };
}

const specs: readonly StartProcessSpec[] = [
  {
    id: "web",
    command: "pnpm",
    args: ["--dir", "apps/web", "dev"],
    cwd: "/app",
  },
  { id: "backend", command: "pnpm", args: ["dev:backend"], cwd: "/app" },
];

function signalFixture() {
  let handler: ((signal: NodeJS.Signals) => void) | undefined;
  return {
    boundary: {
      subscribe: (next: (signal: NodeJS.Signals) => void) => {
        handler = next;
        return () => undefined;
      },
    },
    send: (signal: NodeJS.Signals) => handler?.(signal),
  };
}

describe("process supervisor", () => {
  it.skipIf(process.platform === "win32")(
    "terminates descendants after the process-group leader exits",
    async () => {
      let descendantPid: number | undefined;
      const managed = await createNodeProcessSpawner(() => process.env).spawn(
        {
          id: "leader",
          command: process.execPath,
          args: [
            "-e",
            `const { spawn } = require("node:child_process"); const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }); child.unref(); console.log(child.pid);`,
          ],
          cwd: process.cwd(),
        },
        (_stream, line) => {
          descendantPid = Number(line);
        },
      );
      await managed.completion;
      await vi.waitFor(() => expect(descendantPid).toBeTypeOf("number"));

      try {
        expect(() => process.kill(descendantPid as number, 0)).not.toThrow();
        await managed.terminate("SIGTERM");
        await vi.waitFor(() =>
          expect(() => process.kill(descendantPid as number, 0)).toThrow(),
        );
      } finally {
        try {
          process.kill(descendantPid as number, "SIGKILL");
        } catch {
          // Already stopped by the supervisor.
        }
      }
    },
  );

  it("announces only after readiness and keeps supervising afterward", async () => {
    const fixture = fixtureSpawner();
    const ready = deferred<boolean>();
    const onReady = vi.fn();
    const running = superviseProcesses(specs, {
      spawner: fixture.spawner,
      signals: { subscribe: () => () => undefined },
      log: vi.fn(),
      readiness: { wait: () => ready.promise, onReady },
    });
    await vi.waitFor(() => expect(fixture.children).toHaveLength(2));
    expect(onReady).not.toHaveBeenCalled();
    ready.resolve(true);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    fixture.children[0]?.finish.resolve({ code: 1, signal: null });

    await expect(running).resolves.toEqual({
      kind: "child-exit",
      completion: { code: 1, signal: null },
    });
    expect(fixture.children[1]?.child.terminate).toHaveBeenCalledWith(
      "SIGTERM",
    );
  });

  it("fails immediate exit and readiness timeout without announcing", async () => {
    for (const posture of ["exit", "timeout"] as const) {
      const fixture = fixtureSpawner();
      const ready = deferred<boolean>();
      const onReady = vi.fn();
      const running = superviseProcesses(specs, {
        spawner: fixture.spawner,
        signals: { subscribe: () => () => undefined },
        log: () => undefined,
        readiness: { wait: () => ready.promise, onReady },
      });
      await vi.waitFor(() => expect(fixture.children).toHaveLength(2));
      if (posture === "exit")
        fixture.children[0]?.finish.resolve({ code: 0, signal: null });
      else ready.resolve(false);
      await expect(running).resolves.toMatchObject({
        kind: posture === "exit" ? "child-exit" : "readiness-timeout",
      });
      expect(onReady).not.toHaveBeenCalled();
    }
  });

  it("treats only its subscribed user signal as clean shutdown", async () => {
    const user = fixtureSpawner();
    const signals = signalFixture();
    const running = superviseProcesses(specs, {
      spawner: user.spawner,
      signals: signals.boundary,
      log: () => undefined,
      readiness: { wait: async () => true, onReady: () => undefined },
    });
    await vi.waitFor(() => expect(user.children).toHaveLength(2));
    signals.send("SIGINT");
    await expect(running).resolves.toEqual({
      kind: "user-signal",
      signal: "SIGINT",
    });

    const unsolicited = fixtureSpawner();
    const failed = superviseProcesses(specs, {
      spawner: unsolicited.spawner,
      signals: { subscribe: () => () => undefined },
      log: () => undefined,
      readiness: { wait: async () => true, onReady: () => undefined },
    });
    await vi.waitFor(() => expect(unsolicited.children).toHaveLength(2));
    unsolicited.children[0]?.finish.resolve({ code: null, signal: "SIGTERM" });
    await expect(failed).resolves.toEqual({
      kind: "child-exit",
      completion: { code: null, signal: "SIGTERM" },
    });
  });

  it("closes sequential admission when shutdown begins", async () => {
    const signals = signalFixture();
    const finish = deferred<{ code: number | null; signal: string | null }>();
    const spawn = vi.fn<ProcessSpawner["spawn"]>(async () => {
      signals.send("SIGTERM");
      return {
        completion: finish.promise,
        terminate: async (signal) => finish.resolve({ code: null, signal }),
      };
    });
    await expect(
      superviseProcesses(specs, {
        spawner: { spawn },
        signals: signals.boundary,
        log: () => undefined,
        readiness: { wait: async () => true, onReady: vi.fn() },
      }),
    ).resolves.toEqual({ kind: "user-signal", signal: "SIGTERM" });
    expect(spawn).toHaveBeenCalledOnce();
  });

  it("returns unavailable spawn posture and redacts grouped logs", async () => {
    const fixture = fixtureSpawner();
    const spawn = vi
      .fn<ProcessSpawner["spawn"]>()
      .mockImplementationOnce(fixture.spawner.spawn)
      .mockRejectedValueOnce(new Error("ENOENT"));
    await expect(
      superviseProcesses(specs, {
        spawner: { spawn },
        signals: { subscribe: () => () => undefined },
        log: () => undefined,
        readiness: { wait: async () => true, onReady: vi.fn() },
      }),
    ).resolves.toEqual({ kind: "spawn-failed" });
    expect(fixture.children[0]?.child.terminate).toHaveBeenCalledWith(
      "SIGTERM",
    );
    expect(redactStartLog("Authorization: Bearer abc KEY=value safe=yes")).toBe(
      "Authorization: Bearer [REDACTED] KEY=[REDACTED] safe=yes",
    );
  });

  it("classifies stubborn termination and completion instead of waiting forever", async () => {
    const trigger = deferred<{ code: number | null; signal: string | null }>();
    const never = new Promise<{ code: number | null; signal: string | null }>(
      () => undefined,
    );
    const spawn = vi
      .fn<ProcessSpawner["spawn"]>()
      .mockResolvedValueOnce({
        completion: trigger.promise,
        terminate: async () => undefined,
      })
      .mockResolvedValueOnce({
        completion: never,
        terminate: () => new Promise<void>(() => undefined),
      });
    const running = superviseProcesses(specs, {
      spawner: { spawn },
      signals: { subscribe: () => () => undefined },
      log: () => undefined,
      readiness: { wait: async () => true, onReady: () => undefined },
      cleanupTimeoutMs: 5,
    });
    await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(2));
    trigger.resolve({ code: 1, signal: null });

    await expect(running).resolves.toEqual({ kind: "cleanup-timeout" });
  });

  it("uses platform-correct process-tree requests without shell interpolation", () => {
    expect(processTreeSignalRequest("win32", 42, "SIGTERM")).toEqual({
      kind: "windows",
      command: "taskkill",
      args: ["/pid", "42", "/t"],
      shell: false,
    });
    expect(processTreeSignalRequest("win32", 42, "SIGKILL")).toEqual({
      kind: "windows",
      command: "taskkill",
      args: ["/pid", "42", "/t", "/f"],
      shell: false,
    });
    expect(processTreeSignalRequest("linux", 42, "SIGTERM")).toEqual({
      kind: "posix",
      pid: -42,
      signal: "SIGTERM",
    });
  });
});
