import { describe, expect, it, vi } from "vitest";
import {
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

describe("process supervisor", () => {
  it("uses exact argv/cwd, groups redacted logs, and cleans siblings", async () => {
    const fixture = fixtureSpawner();
    const logs: string[] = [];
    const running = superviseProcesses(specs, {
      spawner: fixture.spawner,
      signals: { subscribe: () => () => undefined },
      log: (line) => logs.push(line),
    });
    await vi.waitFor(() => expect(fixture.children).toHaveLength(2));
    fixture.children[0]?.finish.resolve({ code: 1, signal: null });

    await expect(running).resolves.toEqual({ code: 1, signal: null });
    expect(fixture.children.map(({ spec }) => spec)).toEqual(specs);
    expect(fixture.children[1]?.child.terminate).toHaveBeenCalledWith(
      "SIGTERM",
    );
    expect(logs).toEqual([
      "[web] ready TOKEN=[REDACTED]",
      "[backend] ready TOKEN=[REDACTED]",
    ]);
  });

  it("forwards a signal to every child and leaves none running", async () => {
    const fixture = fixtureSpawner();
    let signalHandler: ((signal: NodeJS.Signals) => void) | undefined;
    const running = superviseProcesses(specs, {
      spawner: fixture.spawner,
      signals: {
        subscribe: (handler) => {
          signalHandler = handler;
          return () => undefined;
        },
      },
      log: () => undefined,
    });
    await vi.waitFor(() => expect(fixture.children).toHaveLength(2));
    signalHandler?.("SIGINT");

    await expect(running).resolves.toEqual({ code: null, signal: "SIGINT" });
    for (const { child } of fixture.children) {
      expect(child.terminate).toHaveBeenCalledWith("SIGINT");
    }
  });

  it("cleans already-started children when a later spawn fails", async () => {
    const fixture = fixtureSpawner();
    const spawn = vi
      .fn<ProcessSpawner["spawn"]>()
      .mockImplementationOnce(fixture.spawner.spawn)
      .mockRejectedValueOnce(new Error("spawn failed"));

    await expect(
      superviseProcesses(specs, {
        spawner: { spawn },
        signals: { subscribe: () => () => undefined },
        log: () => undefined,
      }),
    ).rejects.toThrow("spawn failed");
    expect(fixture.children[0]?.child.terminate).toHaveBeenCalledWith(
      "SIGTERM",
    );
  });

  it("redacts bearer tokens and secret assignments", () => {
    expect(
      redactStartLog("Authorization: Bearer abc.def KEY=value safe=yes"),
    ).toBe("Authorization: Bearer [REDACTED] KEY=[REDACTED] safe=yes");
  });
});
