import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";

import {
  createContractsRuntimeController,
  proxyContractsRequest,
  redactContractsDiagnostic,
} from "./acceptance/support/runtime";
import type { ContractsRuntimeDependencies } from "./acceptance/support/runtime";

describe("Playwright acceptance runtime support", () => {
  it("forwards native backend responses without changing status, content type, or bytes", async () => {
    const response = {
      status: () => 201,
      headers: () => ({ "content-type": "application/octet-stream" }),
      body: async () => Buffer.from("backend-bytes"),
    };
    let fulfilled: unknown;
    const route = {
      fetch: async (options: unknown) => {
        assert.deepEqual(options, {
          method: "POST",
          headers: {
            authorization: "Bearer mtk_live_test",
            "content-type": "application/json",
          },
          postData: JSON.stringify({ input: {}, workspaceSlug: "primary" }),
          url: "http://127.0.0.1:4101/api/records.create",
        });
        return response;
      },
      fulfill: async (value: unknown) => {
        fulfilled = value;
      },
      request: () => ({
        method: () => "POST",
        postData: () => JSON.stringify({ input: {} }),
        url: () => "http://127.0.0.1:4100/__contracts/api/records.create",
      }),
    };
    await proxyContractsRequest({
      requestRoute: route as never,
      apiBaseUrl: "http://127.0.0.1:4101",
      apiKey: "mtk_live_test",
      workspaceSlug: "primary",
    });
    assert.deepEqual(fulfilled, { response });
  });

  it("returns only a safe failure response when proxy forwarding fails", async () => {
    let fulfilled: unknown;
    await proxyContractsRequest({
      requestRoute: {
        fetch: async () => {
          throw new Error("secret-api-key");
        },
        fulfill: async (value: unknown) => {
          fulfilled = value;
        },
        request: () => ({
          method: () => "POST",
          postData: () => JSON.stringify({ input: {} }),
          url: () => "http://127.0.0.1:4100/__contracts/api/records.create",
        }),
      } as never,
      apiBaseUrl: "http://127.0.0.1:4101",
      apiKey: "mtk_live_secret",
      workspaceSlug: "primary",
    });
    expect(fulfilled).toEqual({ status: 502 });
  });

  it("redacts API keys and authorization headers from bounded diagnostics", () => {
    const jsonHeaders = JSON.stringify({
      Authorization: "Basic auth-json-canary",
      Cookie: 'session="json-cookie-canary"',
    });
    const diagnostic = redactContractsDiagnostic(
      `${"x".repeat(20_000)}\nAPI_KEY=key-canary\nAuthorization: Bearer bearer-canary\n${jsonHeaders}`,
      ["key-canary"],
    );
    expect(diagnostic).not.toContain("key-canary");
    expect(diagnostic).not.toContain("bearer-canary");
    expect(diagnostic).not.toContain("auth-json-canary");
    expect(diagnostic).not.toContain("json-cookie-canary");
    expect(diagnostic).toContain("[REDACTED]");
    expect(diagnostic.length).toBeLessThanOrEqual(19_900);
  });

  it("uses one disposable API base for the browser proxy and CLI child process", async () => {
    const environments: NodeJS.ProcessEnv[] = [];
    const appEnvironments: NodeJS.ProcessEnv[] = [];
    const commands: (readonly string[])[] = [];
    const startupSteps: string[] = [];
    let port = 4100;
    const dependencies = {
      cwd: process.cwd(),
      environment: () => ({
        PATH: process.env.PATH,
        FORCE_COLOR: "1",
        NO_COLOR: "1",
      }),
      freePort: async () => port++,
      launchBrowser: async () => ({
        close: async () => undefined,
        newContext: async () => ({ close: async () => undefined }),
      }),
      randomBytes: (size: number) => new Uint8Array(size).fill(1),
      runCommand: async (
        args: readonly string[],
        environment: NodeJS.ProcessEnv,
      ) => {
        environments.push(environment);
        commands.push(args);
        startupSteps.push(
          args.includes("env")
            ? `env:${args.at(-2)}`
            : args.includes("convex")
              ? "init"
              : "other",
        );
        const isSeed = args.includes("headless/apiKeys:seedLocalContracts");
        const isCli = args.includes("maestro");
        return {
          completion: Promise.resolve({
            code: 0,
            signal: null,
            stdout: isSeed
              ? JSON.stringify({
                  primary: {
                    keyId: "primary",
                    workspaceId: "primary",
                    userId: "primary",
                  },
                  observer: {
                    keyId: "observer",
                    workspaceId: "observer",
                    userId: "observer",
                  },
                })
              : isCli
                ? JSON.stringify({ result: [] })
                : "",
            stderr: "",
          }),
          terminate: async () => undefined,
        };
      },
      spawnApp: async (
        spec: unknown,
        output: (stream: "stdout" | "stderr", line: string) => void,
      ) => {
        appEnvironments.push(
          (spec as { readonly environment: NodeJS.ProcessEnv }).environment,
        );
        startupSteps.push("start");
        queueMicrotask(() =>
          output("stdout", "[maestro] URL: http://127.0.0.1:4100"),
        );
        return {
          completion: new Promise(() => undefined),
          terminate: async () => undefined,
        };
      },
    } as unknown as ContractsRuntimeDependencies;
    const controller = createContractsRuntimeController(dependencies);
    const activeRuntime = await controller.start();
    assert.equal(Object.isFrozen(activeRuntime), true);
    expect(startupSteps.slice(0, 4)).toEqual([
      "start",
      "env:MAESTRO_CONTRACT_TEST",
      "env:POSTHOG_PROJECT_TOKEN",
      "env:WORKOS_CLIENT_ID",
    ]);
    expect(commands.slice(0, 3)).toEqual([
      [
        "--silent",
        "exec",
        "convex",
        "env",
        "set",
        "MAESTRO_CONTRACT_TEST",
        "1",
      ],
      [
        "--silent",
        "exec",
        "convex",
        "env",
        "set",
        "POSTHOG_PROJECT_TOKEN",
        "phc_test_placeholder",
      ],
      [
        "--silent",
        "exec",
        "convex",
        "env",
        "set",
        "WORKOS_CLIENT_ID",
        "client_test_contracts_runtime",
      ],
    ]);
    for (const environment of [...environments, ...appEnvironments]) {
      expect(environment.FORCE_COLOR).toBeUndefined();
      expect(environment.NO_COLOR).toBe("1");
    }
    const activeScenario = await activeRuntime.provisionScenario();
    assert.equal(Object.isFrozen(activeScenario), true);
    assert.equal(Object.isFrozen(activeScenario.primary), true);
    assert.equal(Object.isFrozen(activeScenario.observer), true);
    const originalRunCli = activeRuntime.runCli;
    const runtimeAlias = activeRuntime;
    assert.throws(
      () =>
        Object.assign(runtimeAlias, {
          runCli: async () => "tampered",
        }),
      TypeError,
    );
    assert.equal(activeRuntime.runCli, originalRunCli);
    const originalWorkspaceSlug = activeScenario.workspaceSlug;
    const scenarioAlias = activeScenario;
    assert.throws(
      () => Object.assign(scenarioAlias, { workspaceSlug: "tampered" }),
      TypeError,
    );
    assert.equal(activeScenario.workspaceSlug, originalWorkspaceSlug);
    let routeHandler: ((route: never) => Promise<void>) | undefined;
    await activeRuntime.authorizeBrowserContext(activeScenario, {
      route: async (
        _pattern: string,
        handler: (route: never) => Promise<void>,
      ) => {
        routeHandler = handler;
      },
    } as never);
    let browserProxyUrl = "";
    let fulfilled: unknown;
    await routeHandler?.({
      request: () => ({
        method: () => "POST",
        postData: () => JSON.stringify({ input: {} }),
        url: () => "http://127.0.0.1:4100/__contracts/api/records.list",
      }),
      fetch: async (options: unknown) => {
        browserProxyUrl = (options as { readonly url: string }).url;
        return {};
      },
      fulfill: async (value: unknown) => {
        fulfilled = value;
      },
    } as never);
    assert.equal(new URL(browserProxyUrl).origin, activeRuntime.apiBaseUrl);
    assert.deepEqual(fulfilled, { response: {} });
    await activeRuntime.runCli(activeScenario, [
      "capability",
      "run",
      "records.list",
    ]);
    expect(
      commands.find((args) =>
        args.includes("headless/apiKeys:seedLocalContracts"),
      ),
    ).toEqual([
      "--silent",
      "exec",
      "convex",
      "run",
      "headless/apiKeys:seedLocalContracts",
      expect.any(String),
    ]);
    expect(commands.at(-1)).toEqual([
      "--silent",
      "maestro",
      "--",
      "capability",
      "run",
      "records.list",
    ]);
    assert.equal(
      environments.at(-1)?.MAESTRO_API_BASE_URL,
      activeRuntime.apiBaseUrl,
    );
    await controller.stop();
  });
});
