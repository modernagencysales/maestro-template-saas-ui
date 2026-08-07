import type { Browser, BrowserContext, Route } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  createContractsRuntimeController,
  type ContractsRuntimeDependencies,
} from "./contracts-runtime";

const pending = new Promise<{ readonly code: number; readonly signal: null }>(
  () => undefined,
);

function harness(options?: { readonly exitBeforeReady?: boolean }) {
  const environments: NodeJS.ProcessEnv[] = [];
  const terminate = vi.fn(async () => undefined);
  const closeBrowser = vi.fn(async () => undefined);
  const fetchRequest = vi.fn<typeof globalThis.fetch>(async (...args) => {
    void args;
    return new Response(JSON.stringify({ ok: true, result: [] }), {
      headers: { "content-type": "application/json" },
    });
  });
  const launchBrowser: ContractsRuntimeDependencies["launchBrowser"] = vi.fn(
    async (environment) => {
      environments.push(environment);
      return {
        close: closeBrowser,
        newContext: vi.fn(),
      } as unknown as Browser;
    },
  );
  const runCommand: ContractsRuntimeDependencies["runCommand"] = vi.fn(
    async (args, environment) => {
      environments.push(environment);
      if (args.includes("headless/apiKeys:seedLocalContracts")) {
        const input = JSON.parse(args.at(-1) ?? "{}") as {
          readonly namespace: string;
        };
        return JSON.stringify({
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
      }
      if (args.includes("capability")) {
        return `TOKEN=child-output ${environment.MAESTRO_API_KEY}`;
      }
      return "";
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
      CI_TOKEN: "inherited-token-canary",
      PROVIDER_CREDENTIAL: "provider-canary",
      SAFE_SETTING: "not-allowlisted",
    }),
    freePort: async () => 4100 + random++,
    fetch: fetchRequest as typeof globalThis.fetch,
    launchBrowser,
    randomBytes: (size) => new Uint8Array(size).fill(++random),
    runCommand,
    spawnApp,
  };
  return {
    closeBrowser,
    dependencies,
    environments,
    fetchRequest,
    launchBrowser,
    spawnApp,
    terminate,
  };
}

describe("contracts runtime", () => {
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
