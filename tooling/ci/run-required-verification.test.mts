import { spawn, type ChildProcess } from "node:child_process";
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
import { afterEach, describe, expect, it } from "vitest";

const orchestrator = resolve("tooling/ci/run-required-verification.mjs");
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
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("required verification orchestration", () => {
  it("starts coverage and non-coverage lanes together and waits for both", async () => {
    const fixture = createFixture("complete");
    const completion = await waitForExit(runOrchestrator(fixture));
    const events = readEvents(fixture.log);

    expect(completion).toEqual({ code: 1, signal: null });
    expect([...labels(events, "start")].sort()).toEqual(
      ["check:coverage-ratchet", "verify:without-coverage"].sort(),
    );
    expect(Math.max(...indexes(events, "start"))).toBeLessThan(
      Math.min(...indexes(events, "end")),
    );
    expect(labels(events, "end")).toHaveLength(2);
  });

  it.each([
    ["SIGTERM", 143],
    ["SIGINT", 130],
  ] as const)(
    "forwards %s to both active process groups",
    async (signal, code) => {
      const fixture = createFixture("signal");
      const child = runOrchestrator(fixture);
      await waitFor(
        () => labels(readEvents(fixture.log), "descendant-start").length === 2,
      );

      const completion = waitForExit(child);
      child.kill(signal);
      const exit = await completion;
      await waitFor(
        () => labels(readEvents(fixture.log), "descendant-signal").length === 2,
      );

      expect(exit).toEqual({ code, signal: null });
      expect(
        readEvents(fixture.log)
          .filter((event) => event.event === "descendant-signal")
          .map((event) => [event.label, event.signal])
          .sort(),
      ).toEqual(
        [
          ["check:coverage-ratchet", signal],
          ["verify:without-coverage", signal],
        ].sort(),
      );
    },
  );
});

function createFixture(mode: "complete" | "signal") {
  const directory = mkdtempSync(join(tmpdir(), "maestro-required-verify-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const log = join(directory, "events.jsonl");
  const pnpm = join(bin, "pnpm");
  const descendant = join(bin, "descendant.mjs");
  writeFileSync(
    descendant,
    `import { appendFileSync } from "node:fs";

const write = (signal) =>
  appendFileSync(process.env.FAKE_PNPM_LOG, JSON.stringify({
    event: "descendant-signal",
    label: process.env.FAKE_LABEL,
    signal,
  }) + "\\n");
appendFileSync(process.env.FAKE_PNPM_LOG, JSON.stringify({
  event: "descendant-start",
  label: process.env.FAKE_LABEL,
}) + "\\n");
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    write(signal);
    process.exit(signal === "SIGTERM" ? 143 : 130);
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
write("start", { pid: process.pid });
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    write("signal", { signal });
    process.exit(signal === "SIGTERM" ? 143 : 130);
  });
}
if (process.env.FAKE_PNPM_MODE === "signal") {
  spawn(process.execPath, [process.env.FAKE_DESCENDANT], {
    env: { ...process.env, FAKE_LABEL: label },
    stdio: "ignore",
  });
  setInterval(() => {}, 1_000);
} else {
  setTimeout(() => {
    write("end");
    process.exit(label === "verify:without-coverage" ? 7 : 0);
  }, label === "verify:without-coverage" ? 80 : 20);
}
`,
    "utf8",
  );
  chmodSync(pnpm, 0o755);
  return { bin, descendant, log, mode };
}

function runOrchestrator(fixture: ReturnType<typeof createFixture>) {
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

function waitForExit(child: ChildProcess) {
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

function labels(events: readonly Event[], event: Event["event"]) {
  return events
    .filter((entry) => entry.event === event)
    .map((entry) => entry.label);
}

function indexes(events: readonly Event[], event: Event["event"]) {
  return events
    .map((entry, index) => (entry.event === event ? index : -1))
    .filter((index) => index >= 0);
}
