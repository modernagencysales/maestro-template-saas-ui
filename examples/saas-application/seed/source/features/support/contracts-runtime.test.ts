import type { Browser, BrowserContext, Route } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  CONTRACTS_HOOK_TIMEOUT_MS,
  CONTRACTS_RUNTIME_STARTUP_TIMEOUT_MS,
  createContractsRuntimeController,
  spawnManagedCommand,
  type ContractsRuntimeDependencies,
} from "./contracts-runtime";

const pending = new Promise<{ readonly code: number; readonly signal: null }>(
  () => undefined,
);

const pendingCommand = new Promise<{
  readonly code: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
}>(() => undefined);

const commandKind = (args: readonly string[]) => {
  if (args.includes("headless/apiKeys:seedLocalContracts")) return "seed";
  if (args.includes("maestro")) return "cli";
  return "setup";
};

const failedSeedExitCode = (failed: boolean | undefined) => (failed ? 1 : 0);

function harness(options?: {
  readonly deferCleanup?: boolean;
  readonly exitBeforeReady?: boolean;
  readonly hangBrowser?: boolean;
  readonly hangCommand?: "setup" | "seed" | "cli";
  readonly cliDiagnostics?: boolean;
  readonly commandTimeoutMs?: number;
  readonly seedFailure?: boolean;
  readonly startupTimeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly seedTimeoutMs?: number;
}) {
  const environments: NodeJS.ProcessEnv[] = [];
  let releaseCleanup = () => undefined;
  const cleanupReleased = new Promise<void>((resolve) => {
    releaseCleanup = resolve;
  });
  const awaitCleanupRelease = async () => {
    if (options?.deferCleanup) await cleanupReleased;
  };
  const terminate = vi.fn(awaitCleanupRelease);
  const terminateCommand = vi.fn(async () => undefined);
  const closeBrowser = vi.fn(awaitCleanupRelease);
  const fetchRequest = vi.fn<typeof globalThis.fetch>(async (...args) => {
    void args;
    return new Response(JSON.stringify({ ok: true, result: [] }), {
      headers: { "content-type": "application/json" },
    });
  });
  const launchBrowser: ContractsRuntimeDependencies["launchBrowser"] = vi.fn(
    async (environment) => {
      environments.push(environment);
      if (options?.hangBrowser) {
        return await new Promise<Browser>(() => undefined);
      }
      return {
        close: closeBrowser,
        newContext: vi.fn(),
      } as unknown as Browser;
    },
  );
  const runCommand: ContractsRuntimeDependencies["runCommand"] = vi.fn(
    async (args, environment) => {
      environments.push(environment);
      const kind = commandKind(args);
      if (options?.hangCommand === kind) {
        return { completion: pendingCommand, terminate: terminateCommand };
      }
      let stdout = "";
      let stderr = "";
      let code = 0;
      if (kind === "seed") {
        const input = JSON.parse(args.at(-1) ?? "{}") as {
          readonly namespace: string;
        };
        stdout = JSON.stringify({
          primary: {
            keyId: `${input.namespace}-primary-key`,
            workspaceId: `${input.namespace}-primary-workspace`,
            userId: `${input.namespace}-primary-user`,
          },
          observer: {
            keyId: `${input.namespace}-observer-key`,
            workspaceId: `${input.namespace}-observer-workspace`,
            userId: `${input.namespace}-observer-user`,
          },
        });
        code = failedSeedExitCode(options?.seedFailure);
      }
      if (kind === "cli" && options?.cliDiagnostics) {
        code = 1;
        stderr = `${"x".repeat(25_000)}\nTOKEN: token-canary\n{"apiKey":"json-canary","secret": "secret-canary"}\nAuthorization: Bearer bearer-canary\nSet-Cookie: session=cookie-canary; Path=/`;
      } else if (kind === "cli") {
        stdout = `TOKEN=child-output ${environment.MAESTRO_API_KEY}`;
      }
      return {
        completion: Promise.resolve({ code, signal: null, stdout, stderr }),
        terminate: terminateCommand,
      };
    },
  );
  const spawnApp: ContractsRuntimeDependencies["spawnApp"] = vi.fn(
    async (spec, output) => {
      environments.push(spec.environment);
      if (options?.exitBeforeReady) {
        output("stderr", "TOKEN=child-canary PASSWORD=also-secret");
        return {
          completion: Promise.resolve({ code: 1, signal: null }),
          terminate,
        };
      }
      queueMicrotask(() =>
        output("stdout", "[maestro] URL: http://127.0.0.1:4100"),
      );
      return { completion: pending, terminate };
    },
  );
  let random = 0;
  const dependencies: ContractsRuntimeDependencies = {
    cwd: "/tmp/contracts-runtime-test",
    environment: () => ({
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: "en_US.UTF-8",
      CI_TOKEN: ["inherited", "token", "canary"].join("-"),
      PROVIDER_CREDENTIAL: "provider-canary",
      SAFE_SETTING: "not-allowlisted",
    }),
    freePort: async () => 4100 + random++,
    fetch: fetchRequest as typeof globalThis.fetch,
    launchBrowser,
    randomBytes: (size) => new Uint8Array(size).fill(++random),
    runCommand,
    spawnApp,
    commandTimeoutMs: options?.commandTimeoutMs ?? 20,
    startupTimeoutMs: options?.startupTimeoutMs,
    seedTimeoutMs: options?.seedTimeoutMs ?? 50,
    readinessTimeoutMs: 50,
    retryDelayMs: options?.retryDelayMs ?? 1,
  };
  return {
    closeBrowser,
    dependencies,
    environments,
    fetchRequest,
    launchBrowser,
    releaseCleanup,
    spawnApp,
    terminate,
    terminateCommand,
  };
}

describe("contracts runtime", () => {
  it("keeps the Cucumber hook deadline above the controller startup deadline", () => {
    expect(CONTRACTS_HOOK_TIMEOUT_MS).toBeGreaterThan(
      CONTRACTS_RUNTIME_STARTUP_TIMEOUT_MS,
    );
  });

  it("bounds the entire controller-owned startup", async () => {
    const test = harness({ hangBrowser: true, startupTimeoutMs: 10 });
    const controller = createContractsRuntimeController(test.dependencies);

    const result = await Promise.race([
      controller.start().catch((error: unknown) => error),
      new Promise<"still-pending">((resolve) => {
        setTimeout(() => resolve("still-pending"), 100);
      }),
    ]);

    expect(result).toBeInstanceOf(Error);
    expect(String(result)).toContain("startup timed out");
    await controller.stop();
  });

  it("settles startup by its deadline when acquired-resource cleanup hangs", async () => {
    const test = harness({
      deferCleanup: true,
      exitBeforeReady: true,
      startupTimeoutMs: 10,
    });
    const controller = createContractsRuntimeController(test.dependencies);

    const result = await Promise.race([
      controller.start().catch((error: unknown) => error),
      new Promise<"still-pending">((resolve) => {
        setTimeout(() => resolve("still-pending"), 100);
      }),
    ]);

    expect(result).toBeInstanceOf(Error);
    expect(String(result)).toContain("startup timed out");
    expect(test.terminate).toHaveBeenCalledOnce();
    expect(test.closeBrowser).toHaveBeenCalledOnce();
    test.releaseCleanup();
    await controller.stop();
  });

  it("memoizes cleanup while failed startup and stop overlap", async () => {
    const test = harness({ deferCleanup: true, exitBeforeReady: true });
    const controller = createContractsRuntimeController(test.dependencies);
    const starting = controller.start().catch((error: unknown) => error);
    await vi.waitFor(() => expect(test.terminate).toHaveBeenCalledOnce());

    const stopping = controller.stop();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(test.terminate).toHaveBeenCalledOnce();
    expect(test.closeBrowser).toHaveBeenCalledOnce();
    test.releaseCleanup();
    await Promise.all([starting, stopping]);
  });

  it("owns one process and browser while provisioning isolated scenarios", async () => {
    const test = harness();
    const controller = createContractsRuntimeController(test.dependencies);

    const [first, second] = await Promise.all([
      controller.start(),
      controller.start(),
    ]);
    const scenarioA = await first.provisionScenario();
    const scenarioB = await first.provisionScenario();

    expect(second).toBe(first);
    expect(test.spawnApp).toHaveBeenCalledTimes(1);
    expect(test.spawnApp).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: expect.objectContaining({
          WORKOS_API_KEY: "fake",
          WORKOS_CLIENT_ID: "client_test_contracts_runtime",
          WORKOS_COOKIE_PASSWORD: "contracts-runtime-test-cookie-password",
          WORKOS_REDIRECT_URI: "http://127.0.0.1:4100/api/auth/callback",
        }),
      }),
      expect.any(Function),
    );
    expect(test.launchBrowser).toHaveBeenCalledTimes(1);
    expect(test.dependencies.runCommand).toHaveBeenCalledWith(
      expect.arrayContaining(["MAESTRO_CONTRACT_TEST", "1"]),
      expect.any(Object),
    );
    expect(scenarioA.namespace).not.toBe(scenarioB.namespace);
    expect(scenarioA.workspaceSlug).not.toBe(scenarioB.workspaceSlug);
    expect(JSON.stringify(scenarioA)).not.toContain("mtk_live_");

    await Promise.all([controller.stop(), controller.stop()]);
    expect(test.terminate).toHaveBeenCalledTimes(1);
    expect(test.closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("uses minimal child environments and redacts CLI output", async () => {
    const test = harness();
    const controller = createContractsRuntimeController(test.dependencies);
    const runtime = await controller.start();
    const scenario = await runtime.provisionScenario();

    const output = await runtime.runCli(scenario, [
      "capability",
      "run",
      "records.list",
    ]);
    const cliEnvironment = test.environments.at(-1) ?? {};

    for (const environment of test.environments) {
      expect(environment).not.toHaveProperty("CI_TOKEN");
      expect(environment).not.toHaveProperty("PROVIDER_CREDENTIAL");
      expect(environment).not.toHaveProperty("SAFE_SETTING");
    }
    expect(cliEnvironment.MAESTRO_API_KEY).toMatch(/^mtk_live_/);
    expect(output).not.toContain(cliEnvironment.MAESTRO_API_KEY);
    expect(output).not.toContain("child-output");
    expect(output).toContain("[REDACTED]");

    await controller.stop();
  });

  it("cleans up partial startup and redacts bounded diagnostics", async () => {
    const test = harness({ exitBeforeReady: true });
    const controller = createContractsRuntimeController(test.dependencies);

    const failure = await controller.start().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain("exited before readiness");
    expect(String(failure)).not.toContain("child-canary");
    expect(String(failure)).not.toContain("also-secret");
    expect(test.terminate).toHaveBeenCalledTimes(1);
    expect(test.closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("bounds and terminates a hung startup command", async () => {
    const test = harness({ hangCommand: "setup" });
    const controller = createContractsRuntimeController(test.dependencies);

    await expect(controller.start()).rejects.toThrow(/timed out/u);

    expect(test.terminateCommand).toHaveBeenCalled();
    expect(test.launchBrowser).not.toHaveBeenCalled();
    await controller.stop();
  });

  it("bounds and terminates hung seed attempts", async () => {
    const test = harness({ hangCommand: "seed" });
    const controller = createContractsRuntimeController(test.dependencies);
    const runtime = await controller.start();

    await expect(runtime.provisionScenario()).rejects.toThrow(/timed out/u);

    expect(test.terminateCommand).toHaveBeenCalled();
    await controller.stop();
  });

  it("stops a failed seed before its next retry delay", async () => {
    const test = harness({
      seedFailure: true,
      retryDelayMs: 10_000,
      seedTimeoutMs: 20_000,
    });
    const controller = createContractsRuntimeController(test.dependencies);
    const runtime = await controller.start();
    const provisioning = runtime
      .provisionScenario()
      .catch((error: unknown) => error);
    const seedAttempts = () =>
      vi
        .mocked(test.dependencies.runCommand)
        .mock.calls.filter(([args]) => commandKind(args) === "seed").length;
    await vi.waitFor(() => expect(seedAttempts()).toBe(1));

    await controller.stop();
    const result = await Promise.race([
      provisioning,
      new Promise<"still-pending">((resolve) => {
        setTimeout(() => resolve("still-pending"), 100);
      }),
    ]);

    expect(result).toBeInstanceOf(Error);
    expect(String(result)).toContain("stopped");
    expect(seedAttempts()).toBe(1);
  });

  it("waits for command streams to close before snapshotting output", async () => {
    const script = `
      const { spawn } = require("node:child_process");
      spawn(process.execPath, ["-e", "setTimeout(() => process.stdout.write('late\\\\n'), 30)"], {
        detached: true,
        stdio: ["ignore", process.stdout, process.stderr],
      }).unref();
      process.stdout.write("early\\n");
    `;

    const command = await spawnManagedCommand({
      command: process.execPath,
      args: ["-e", script],
      cwd: process.cwd(),
      environment: process.env,
    });
    const result = await command.completion;

    expect(result.stdout).toContain("early\n");
    expect(result.stdout).toContain("late\n");
    await expect(command.terminate("SIGINT")).resolves.toBeUndefined();
  });

  it("bounds and terminates a hung CLI command", async () => {
    const test = harness({ hangCommand: "cli" });
    const controller = createContractsRuntimeController(test.dependencies);
    const runtime = await controller.start();
    const scenario = await runtime.provisionScenario();

    await expect(
      runtime.runCli(scenario, ["capability", "run", "records.list"]),
    ).rejects.toThrow(/timed out/u);

    expect(test.terminateCommand).toHaveBeenCalled();
    await controller.stop();
  });

  it("aborts a tracked startup command when stopped", async () => {
    const test = harness({ hangCommand: "setup", commandTimeoutMs: 10_000 });
    const controller = createContractsRuntimeController(test.dependencies);

    const starting = controller.start();
    await vi.waitFor(() =>
      expect(test.dependencies.runCommand).toHaveBeenCalled(),
    );
    await controller.stop();

    await expect(starting).rejects.toThrow();
    expect(test.terminateCommand).toHaveBeenCalled();
  });

  it("redacts realistic secret diagnostics and bounds retained output", async () => {
    const test = harness({ cliDiagnostics: true });
    const controller = createContractsRuntimeController(test.dependencies);
    const runtime = await controller.start();
    const scenario = await runtime.provisionScenario();

    const failure = await runtime
      .runCli(scenario, ["capability", "run", "records.list"])
      .catch((error: unknown) => error);
    const diagnostic = String(failure);

    for (const canary of [
      "token-canary",
      "json-canary",
      "secret-canary",
      "bearer-canary",
      "cookie-canary",
    ]) {
      expect(diagnostic).not.toContain(canary);
    }
    expect(diagnostic).toContain("[REDACTED]");
    expect(diagnostic.length).toBeLessThanOrEqual(20_000);
    await controller.stop();
  });

  it("routes browser contract requests through scenario credentials", async () => {
    const test = harness();
    const controller = createContractsRuntimeController(test.dependencies);
    const runtime = await controller.start();
    const scenario = await runtime.provisionScenario();
    const route = vi.fn();

    await runtime.authorizeBrowserContext(scenario, {
      route,
    } as unknown as BrowserContext);

    expect(route).toHaveBeenCalledOnce();
    expect(route).toHaveBeenCalledWith(
      "**/__contracts/api/**",
      expect.any(Function),
    );
    const handler = route.mock.calls[0]?.[1] as
      ((route: Route) => Promise<void>) | undefined;
    const fulfill = vi.fn(async () => undefined);
    expect(handler).toBeDefined();
    await handler?.({
      request: () => ({
        method: () => "POST",
        postData: () =>
          JSON.stringify({ workspaceSlug: "template-demo", input: {} }),
        url: () => "http://127.0.0.1:4100/__contracts/api/records.list",
      }),
      fulfill,
    } as unknown as Route);
    const requestInit = test.fetchRequest.mock.calls[0]?.[1];
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      workspaceSlug: scenario.workspaceSlug,
    });
    const authorization = (requestInit?.headers as Record<string, string>)
      .authorization;
    expect(authorization?.startsWith("Bearer mtk_live_")).toBe(true);
    expect(fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200 }),
    );
    await controller.stop();
  });
});
