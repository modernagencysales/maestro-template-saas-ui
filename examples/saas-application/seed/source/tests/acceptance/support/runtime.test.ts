import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";

import {
  createContractsRuntimeController,
  proxyContractsRequest,
  redactContractsDiagnostic,
} from "./runtime";
import type { ContractsRuntimeDependencies } from "./runtime";

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
      route: route as never,
      apiBaseUrl: "http://127.0.0.1:4101",
      apiKey: "mtk_live_test",
      workspaceSlug: "primary",
    });
    assert.deepEqual(fulfilled, { response });
  });

  it("returns only a safe failure response when proxy forwarding fails", async () => {
    let fulfilled: unknown;
    await proxyContractsRequest({
      route: {
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
    const diagnostic = redactContractsDiagnostic(
      `${"x".repeat(20_000)}\nAPI_KEY=key-canary\nAuthorization: Bearer bearer-canary`,
      ["key-canary"],
    );
    expect(diagnostic).not.toContain("key-canary");
    expect(diagnostic).not.toContain("bearer-canary");
    expect(diagnostic).toContain("[REDACTED]");
    expect(diagnostic.length).toBeLessThanOrEqual(19_900);
  });

  it("uses one disposable API base for the browser proxy and CLI child process", async () => {
    const environments: NodeJS.ProcessEnv[] = [];
    let port = 4100;
    const dependencies = {
      cwd: process.cwd(),
      environment: () => ({ PATH: process.env.PATH }),
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
        _spec: unknown,
        output: (stream: "stdout" | "stderr", line: string) => void,
      ) => {
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
    const activeScenario = await activeRuntime.provisionScenario();
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
    assert.equal(
      environments.at(-1)?.MAESTRO_API_BASE_URL,
      activeRuntime.apiBaseUrl,
    );
    await controller.stop();
  });
});
