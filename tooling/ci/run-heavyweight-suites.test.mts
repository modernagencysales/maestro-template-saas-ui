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
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const orchestrator = resolve("tooling/ci/run-heavyweight-suites.mjs");
const temporaryDirectories: string[] = [];

type Event = {
  readonly event: "start" | "end" | "signal";
  readonly label: string;
  readonly signal?: string;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
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

  it.each(["SIGTERM", "SIGINT"] as const)(
    "forwards %s to both active lanes",
    async (signal) => {
      const fixture = createFixture("signal");
      const child = runOrchestrator(fixture);
      await waitFor(
        () => labels(readEvents(fixture.log), "start").length === 2,
      );

      const completion = waitForExit(child);
      child.kill(signal);

      const exit = await completion;
      const events = readEvents(fixture.log);
      expect(exit).toEqual({
        code: signal === "SIGTERM" ? 143 : 130,
        signal: null,
      });
      expect([...labels(events, "signal")].sort()).toEqual(
        [
          "--dir apps/cli test:customer-cli-runtime",
          "--dir apps/cli test:create-root-integration",
        ].sort(),
      );
      expect(labels(events, "start")).toHaveLength(2);
    },
  );
});

function createFixture(mode: "complete" | "signal"): {
  readonly bin: string;
  readonly log: string;
  readonly mode: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "maestro-heavyweight-suites-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const log = join(directory, "events.jsonl");
  const pnpm = join(bin, "pnpm");
  writeFileSync(
    pnpm,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";

const label = process.argv.slice(2).join(" ");
const write = (event, extra = {}) =>
  appendFileSync(process.env.FAKE_PNPM_LOG, JSON.stringify({ event, label, ...extra }) + "\\n");
write("start");
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    write("signal", { signal });
    process.exit(signal === "SIGTERM" ? 143 : 130);
  });
}
if (process.env.FAKE_PNPM_MODE === "signal") setInterval(() => {}, 1_000);
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
  return { bin, log, mode };
}

function runOrchestrator(fixture: {
  readonly bin: string;
  readonly log: string;
  readonly mode: string;
}) {
  return spawn(process.execPath, [orchestrator], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ""}`,
      FAKE_PNPM_LOG: fixture.log,
      FAKE_PNPM_MODE: fixture.mode,
    },
    stdio: "ignore",
  });
}

function waitForExit(child: ReturnType<typeof spawn>) {
  return new Promise<{
    readonly code: number | null;
    readonly signal: string | null;
  }>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolveExit({ code, signal }));
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
