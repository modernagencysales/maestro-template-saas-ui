import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const orchestrator = resolve("tooling/ci/run-heavyweight-suites.mjs");
const temporaryDirectories: string[] = [];
const orchestrators: ChildProcess[] = [];

type Event = {
  readonly event:
    "start" | "end" | "signal" | "descendant-start" | "descendant-signal";
  readonly label: string;
  readonly pid?: number;
  readonly signal?: string;
};

afterEach(() => {
  for (const child of orchestrators.splice(0)) child.kill("SIGKILL");
  for (const directory of temporaryDirectories.splice(0)) {
    for (const event of readEvents(join(directory, "events.jsonl"))) {
      if (event.event !== "start" || event.pid === undefined) continue;
      try {
        process.kill(-event.pid, "SIGKILL");
      } catch {
        // The process group already exited.
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("heavyweight customer-artifact suite orchestration", () => {
  it("runs two serial lanes to completion and aggregates failures", async () => {
    const fixture = createFixture("complete");
    const child = runOrchestrator(fixture);
    const completion = await waitForExit(child);
    const events = readEvents(fixture.log);

    expect(completion).toEqual({ code: 1, signal: null });
    expect([...labels(events, "start")].sort()).toEqual(
      [
        "--dir apps/cli test:customer-cli-runtime",
        "--dir apps/cli test:create-root-integration",
        "--dir tooling/agent-pack test:privacy-no-network",
        "test:release-filesystem",
      ].sort(),
    );
    expect(
      indexOf(events, "end", "--dir apps/cli test:customer-cli-runtime"),
    ).toBeLessThan(indexOf(events, "start", "test:release-filesystem"));
    expect(
      indexOf(events, "end", "--dir apps/cli test:create-root-integration"),
    ).toBeLessThan(
      indexOf(
        events,
        "start",
        "--dir tooling/agent-pack test:privacy-no-network",
      ),
    );
    expect(
      Math.max(
        indexOf(events, "start", "--dir apps/cli test:customer-cli-runtime"),
        indexOf(events, "start", "--dir apps/cli test:create-root-integration"),
      ),
    ).toBeLessThan(
      Math.min(
        indexOf(events, "end", "--dir apps/cli test:customer-cli-runtime"),
        indexOf(events, "end", "--dir apps/cli test:create-root-integration"),
      ),
    );
    expect(labels(events, "end")).toHaveLength(4);
  });

  it("forwards TERM and INT to both active process groups", async () => {
    const fixture = createFixture("signal");
    const child = runOrchestrator(fixture);
    await waitFor(
      () => labels(readEvents(fixture.log), "descendant-start").length === 2,
    );

    const completion = waitForExit(child);
    child.kill("SIGTERM");
    await waitFor(
      () => labels(readEvents(fixture.log), "descendant-signal").length === 2,
    );
    child.kill("SIGINT");

    const exit = await completion;
    await waitFor(
      () => labels(readEvents(fixture.log), "descendant-signal").length === 4,
    );
    const events = readEvents(fixture.log);
    expect(exit).toEqual({ code: 143, signal: null });
    for (const label of [
      "--dir apps/cli test:customer-cli-runtime",
      "--dir apps/cli test:create-root-integration",
    ]) {
      expect(
        events
          .filter(
            (event) =>
              event.event === "descendant-signal" && event.label === label,
          )
          .map((event) => event.signal),
      ).toEqual(["SIGTERM", "SIGINT"]);
    }
    expect(labels(events, "start")).toHaveLength(2);
  });
});

function createFixture(mode: "complete" | "signal"): {
  readonly bin: string;
  readonly descendant: string;
  readonly log: string;
  readonly mode: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "maestro-heavyweight-suites-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const log = join(directory, "events.jsonl");
  const pnpm = join(bin, "pnpm");
  const descendant = join(bin, "descendant.mjs");
  writeFileSync(
    descendant,
    `import { appendFileSync } from "node:fs";

const label = process.env.FAKE_LABEL;
const write = (event, extra = {}) =>
  appendFileSync(process.env.FAKE_PNPM_LOG, JSON.stringify({ event, label, ...extra }) + "\\n");
const signals = [];
write("descendant-start", { pid: process.pid });
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    signals.push(signal);
    write("descendant-signal", { signal });
    if (signals.length === 2) process.exit(0);
  });
}
setInterval(() => {}, 1_000);
`,
    "utf8",
  );
  writeFileSync(
    pnpm,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";

const label = process.argv.slice(2).join(" ");
const write = (event, extra = {}) =>
  appendFileSync(process.env.FAKE_PNPM_LOG, JSON.stringify({ event, label, ...extra }) + "\\n");
const signals = [];
write("start", { pid: process.pid });
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    signals.push(signal);
    write("signal", { signal });
    if (signals.length === 2) process.exit(signals[0] === "SIGTERM" ? 143 : 130);
  });
}
if (process.env.FAKE_PNPM_MODE === "signal") {
  spawn(process.execPath, [process.env.FAKE_DESCENDANT], {
    env: { ...process.env, FAKE_LABEL: label },
    stdio: "ignore",
  });
  setInterval(() => {}, 1_000);
}
else {
  const delay = label.includes("customer-cli-runtime") ? 80 : 20;
  setTimeout(() => {
    write("end");
    process.exit(label.includes("customer-cli-runtime") || label.includes("create-root-integration") ? 7 : 0);
  }, delay);
}
`,
    "utf8",
  );
  chmodSync(pnpm, 0o755);
  return { bin, descendant, log, mode };
}

function runOrchestrator(fixture: {
  readonly bin: string;
  readonly descendant: string;
  readonly log: string;
  readonly mode: string;
}) {
  const child = spawn(process.execPath, [orchestrator], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ""}`,
      FAKE_DESCENDANT: fixture.descendant,
      FAKE_PNPM_LOG: fixture.log,
      FAKE_PNPM_MODE: fixture.mode,
    },
    stdio: "ignore",
  });
  orchestrators.push(child);
  return child;
}

function waitForExit(child: ReturnType<typeof spawn>) {
  return new Promise<{
    readonly code: number | null;
    readonly signal: string | null;
  }>((resolveExit, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("timed out waiting for orchestrator exit")),
      5_000,
    );
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    if (Date.now() >= deadline)
      throw new Error("timed out waiting for fake pnpm");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
  }
}

function readEvents(path: string): readonly Event[] {
  try {
    return readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Event);
  } catch {
    return [];
  }
}

function labels(
  events: readonly Event[],
  event: Event["event"],
): readonly string[] {
  return events
    .filter((entry) => entry.event === event)
    .map((entry) => entry.label);
}

function indexOf(
  events: readonly Event[],
  event: Event["event"],
  label: string,
): number {
  return events.findIndex(
    (entry) => entry.event === event && entry.label === label,
  );
}
