import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPrerenderRetryCompatibility,
  resolveBoundPreviewUrl,
  retryTransientPrerenderStartup,
  runFinalCustomerCompileGates,
} from "./finalFilesystem.test-support.js";

const execProbe = vi.hoisted(() => ({
  activeCompileCommands: 0,
  maxActiveCompileCommands: 0,
  compileCommands: [] as string[],
  delayedFailures: new Map<string, Error>(),
  failures: new Map<string, Error>(),
}));

vi.mock("node:child_process", () => ({
  execFile: (
    _command: string,
    args: readonly string[],
    _options: unknown,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const label = args.join(" ");
    const compileCommand =
      label.endsWith("typecheck") || label.startsWith("check:workflow-");
    if (!compileCommand) {
      queueMicrotask(() => callback(null, "", ""));
      return;
    }
    execProbe.activeCompileCommands += 1;
    execProbe.maxActiveCompileCommands = Math.max(
      execProbe.maxActiveCompileCommands,
      execProbe.activeCompileCommands,
    );
    execProbe.compileCommands.push(label);
    const complete = (): void => {
      execProbe.activeCompileCommands -= 1;
      callback(
        execProbe.delayedFailures.get(label) ??
          execProbe.failures.get(label) ??
          null,
        "",
        "",
      );
    };
    if (execProbe.delayedFailures.has(label)) setTimeout(complete, 5);
    else queueMicrotask(complete);
  },
}));

const createCompatibilityRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "prerender-compat-"));
  const path = join(
    root,
    "node_modules/.pnpm/@tanstack+start-plugin-core@1.171.39_fixture/node_modules/@tanstack/start-plugin-core/dist/esm/prerender.js",
  );
  const vitePath = join(path, "../vite/prerender.js");
  mkdirSync(join(path, ".."), { recursive: true });
  mkdirSync(join(vitePath, ".."), { recursive: true });
  writeFileSync(
    path,
    [
      "if (retries < (prerenderOptions.retryCount ?? 0)) {",
      "const retryDelay = normalizeRetryDelay(prerenderOptions.retryDelay);",
      "logger.warn(`Encountered error, retrying: ${page.path} in ${retryDelay}ms`);\n\t\t\t\t\t\tawait new Promise",
    ].join("\n"),
  );
  writeFileSync(
    vitePath,
    [
      "return await vite.preview({",
      "\t\t\tconfigFile: viteConfig.configFile,",
      "\t\t\tpreview: {",
      "\t\t\t\tport: 0,",
      "\t\t\t\topen: false",
      "\t\t\t}",
      "\t\t});",
    ].join("\n"),
  );
  return root;
};

beforeEach(() => {
  execProbe.activeCompileCommands = 0;
  execProbe.maxActiveCompileCommands = 0;
  execProbe.compileCommands = [];
  execProbe.delayedFailures.clear();
  execProbe.failures.clear();
});

describe("final filesystem prerender startup retry", () => {
  it.each([
    ["127.0.0.1", "http://127.0.0.1:4311/"],
    ["::1", "http://[::1]:4311/"],
    ["0.0.0.0", "http://127.0.0.1:4311/"],
    ["::", "http://[::1]:4311/"],
  ])("uses the bound %s preview address", (address, expected) => {
    expect(
      resolveBoundPreviewUrl("http://127.0.0.1:4173/", {
        address,
        port: 4311,
      }),
    ).toBe(expected);
  });

  it("enables the installed TanStack retry before customer compilation", () => {
    const root = createCompatibilityRoot();
    const path = join(
      root,
      "node_modules/.pnpm/@tanstack+start-plugin-core@1.171.39_fixture/node_modules/@tanstack/start-plugin-core/dist/esm/prerender.js",
    );
    const vitePath = join(path, "../vite/prerender.js");

    applyPrerenderRetryCompatibility(root);

    const source = readFileSync(path, "utf8");
    expect(source).toContain("seen.delete(page.path)");
    expect(readFileSync(vitePath, "utf8")).toContain(
      'previewServer.httpServer.once("listening", resolve)',
    );
    expect(readFileSync(vitePath, "utf8")).toContain(
      "await fetch(previewServer.resolvedUrls.local[0]",
    );
    expect(readFileSync(vitePath, "utf8")).toContain(
      "previewServer.httpServer.address()",
    );
    expect(readFileSync(vitePath, "utf8")).toContain(
      "resolvedUrl.hostname = boundHost",
    );
    rmSync(root, { recursive: true, force: true });
  });

  it("runs independent compile gates with at most two child processes", async () => {
    const root = createCompatibilityRoot();
    try {
      await runFinalCustomerCompileGates(root, "/tmp/test-pnpm-store");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(execProbe.compileCommands).toEqual([
      "--dir apps/cli typecheck",
      "--dir tooling/generators typecheck",
      "check:workflow-policy-snapshots",
      "check:workflow-principal-propagation",
      "--dir packages/convex typecheck",
      "--dir apps/web typecheck",
    ]);
    expect(execProbe.maxActiveCompileCommands).toBe(2);
  });

  it("keeps the first declared compile failure deterministic", async () => {
    const root = createCompatibilityRoot();
    execProbe.delayedFailures.set(
      "--dir apps/cli typecheck",
      new Error("first compile failure"),
    );
    execProbe.failures.set(
      "--dir tooling/generators typecheck",
      new Error("later compile failure"),
    );
    try {
      await expect(
        runFinalCustomerCompileGates(root, "/tmp/test-pnpm-store"),
      ).rejects.toThrow("first compile failure");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("retries bounded loopback startup refusals until the build succeeds", async () => {
    let attempts = 0;
    const waits: number[] = [];
    const result = await retryTransientPrerenderStartup(
      async () => {
        attempts += 1;
        if (attempts < 3)
          throw new Error("connect ECONNREFUSED 127.0.0.1:41731");
        return "built";
      },
      4,
      async (delayMs) => {
        waits.push(delayMs);
      },
    );

    expect(result).toBe("built");
    expect(attempts).toBe(3);
    expect(waits).toEqual([1_000, 1_000]);
  });

  it("does not retry unrelated build failures", async () => {
    let attempts = 0;
    await expect(
      retryTransientPrerenderStartup(async () => {
        attempts += 1;
        throw new Error("TypeScript compilation failed");
      }),
    ).rejects.toThrow("TypeScript compilation failed");

    expect(attempts).toBe(1);
  });

  it("fails after the bounded startup attempt budget", async () => {
    let attempts = 0;
    await expect(
      retryTransientPrerenderStartup(async () => {
        attempts += 1;
        throw new Error("connect ECONNREFUSED 127.0.0.1:41731");
      }, 3),
    ).rejects.toThrow("ECONNREFUSED");

    expect(attempts).toBe(3);
  });
});
