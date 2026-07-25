import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCliAsync } from "../index";

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("materialized customer CLI runtime closure", () => {
  it("installs, imports, preflights, and supervises fake start without factory-only packages", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-customer-cli-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer");
    const created = await runCliAsync(
      [
        "create",
        target,
        "--name",
        "Runtime Closure",
        "--outcome",
        "Track one customer request",
        "--demo-only",
        "--write",
        "--json",
      ],
      undefined,
      process.cwd(),
    );
    expect(created.exitCode, created.stderr).toBe(0);

    const customerEntry = readFileSync(
      join(target, "apps/cli/src/index.ts"),
      "utf8",
    );
    const customerComposition = readFileSync(
      join(target, "apps/cli/src/factory/customerComposition.ts"),
      "utf8",
    );
    expect(customerEntry).toContain("createCustomerCliComposition");
    expect(customerComposition).not.toMatch(
      /@maestro-template\/(stack-tooling|release-tooling)/,
    );

    execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: target,
      stdio: "pipe",
      timeout: 120_000,
    });
    expect(existsSync(join(target, ".git"))).toBe(false);
    execFileSync("git", ["init", "--quiet"], { cwd: target });
    execFileSync("pnpm", ["run", "prepare"], {
      cwd: target,
      stdio: "pipe",
      timeout: 30_000,
    });
    expect(existsSync(join(target, ".git/hooks/pre-commit"))).toBe(true);
    expect(existsSync(join(target, ".git/hooks/pre-push"))).toBe(true);
    execFileSync("git", ["config", "user.email", "fixture@localhost"], {
      cwd: target,
    });
    execFileSync("git", ["config", "user.name", "Fixture"], { cwd: target });
    execFileSync("git", ["add", "."], { cwd: target });
    execFileSync("git", ["commit", "--quiet", "--no-verify", "-m", "fixture"], {
      cwd: target,
    });
    const hostBin = join(parent, "supported-host-bin");
    mkdirSync(hostBin);
    const corepack = join(hostBin, "corepack");
    writeFileSync(corepack, "#!/bin/sh\nexit 0\n");
    chmodSync(corepack, 0o755);
    const supportedHostEnvironment = {
      ...process.env,
      PATH: `${hostBin}:${process.env.PATH ?? ""}`,
    };
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "--eval",
        'import("./apps/cli/src/index.ts").then(() => console.log("imported"))',
      ],
      { cwd: target, stdio: "pipe", timeout: 30_000 },
    );

    const preflight = spawnSync(
      "pnpm",
      ["--silent", "maestro", "--", "preflight", "--mode", "fake", "--json"],
      {
        cwd: target,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    expect(preflight.error).toBeUndefined();
    expect(() => JSON.parse(preflight.stdout)).not.toThrow();
    expect(preflight.stderr).not.toContain("ERR_MODULE_NOT_FOUND");

    const start = spawn(
      "pnpm",
      ["dlx", "pnpm@10.12.1", "maestro", "--", "start", "--mode", "fake"],
      {
        cwd: target,
        stdio: ["ignore", "pipe", "pipe"],
        env: supportedHostEnvironment,
      },
    );
    let stdout = "";
    let stderr = "";
    start.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    start.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    try {
      await waitUntil(
        () =>
          stderr.includes("[maestro] URL: http://127.0.0.1:5173") &&
          stderr.includes("[maestro] Build Readiness: http://127.0.0.1:4174/"),
        60_000,
        () =>
          `fake start did not become ready (exit=${String(start.exitCode)}):\nstdout=${stdout}\nstderr=${stderr}`,
      );
      await expect(
        fetch("http://127.0.0.1:5173/health"),
      ).resolves.toMatchObject({ status: 200 });
      await expect(fetch("http://127.0.0.1:4174/")).resolves.toMatchObject({
        status: 200,
      });
      const cliPid = findDescendant(start.pid, "apps/cli/src/index.ts");
      if (cliPid === undefined)
        throw new Error("the supervised customer CLI process was not found");
      process.kill(cliPid, "SIGINT");
      const completion = await waitForExit(start, 15_000);
      expect(completion, stderr).toMatchObject({ code: 0, signal: null });
      expect(stdout).toContain("stopped cleanly");
      expect(stderr).not.toContain("ERR_MODULE_NOT_FOUND");
      await expect(portAvailable(5173)).resolves.toBe(true);
      await expect(portAvailable(4174)).resolves.toBe(true);
    } finally {
      if (start.exitCode === null && start.signalCode === null)
        start.kill("SIGKILL");
    }
  }, 180_000);
});

async function waitUntil(
  condition: () => boolean,
  timeoutMs: number,
  message: () => string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(message());
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function waitForExit(
  child: ReturnType<typeof spawn>,
  timeoutMs: number,
): Promise<{ readonly code: number | null; readonly signal: string | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("fake start did not stop within its deadline")),
      timeoutMs,
    );
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function portAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

function findDescendant(
  rootPid: number | undefined,
  commandMarker: string,
): number | undefined {
  if (rootPid === undefined) return undefined;
  const processes = execFileSync("ps", ["-eo", "pid=,ppid=,args="], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      command: match[3] ?? "",
    }));
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of processes) {
      if (
        descendants.has(candidate.parentPid) &&
        !descendants.has(candidate.pid)
      ) {
        descendants.add(candidate.pid);
        changed = true;
      }
    }
  }
  return processes
    .filter(
      ({ pid, command }) =>
        descendants.has(pid) && command.includes(commandMarker),
    )
    .at(-1)?.pid;
}
