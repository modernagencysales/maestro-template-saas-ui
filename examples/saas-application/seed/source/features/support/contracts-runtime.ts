import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";

type SeededActor = {
  readonly keyId: string;
  readonly workspaceId: string;
  readonly userId: string;
};

export type ContractsScenario = {
  readonly namespace: string;
  readonly workspaceSlug: string;
  readonly observerWorkspaceSlug: string;
  readonly primary: SeededActor;
  readonly observer: SeededActor;
};

export type ContractsRuntime = {
  readonly browser: Browser;
  readonly webUrl: string;
  readonly provisionScenario: () => Promise<ContractsScenario>;
  readonly authorizeBrowserContext: (
    scenario: ContractsScenario,
    context: BrowserContext,
  ) => Promise<void>;
  readonly runCli: (
    scenario: ContractsScenario,
    args: readonly string[],
    actor?: "primary" | "observer" | "none",
  ) => Promise<string>;
};

type AppSpec = {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly environment: NodeJS.ProcessEnv;
};

type ManagedProcess = {
  readonly completion: Promise<{
    readonly code: number | null;
    readonly signal: string | null;
  }>;
  readonly terminate: (signal: NodeJS.Signals) => Promise<void>;
};

export type ContractsRuntimeDependencies = {
  readonly cwd: string;
  readonly environment: () => NodeJS.ProcessEnv;
  readonly freePort: () => Promise<number>;
  readonly launchBrowser: (environment: NodeJS.ProcessEnv) => Promise<Browser>;
  readonly randomBytes: (size: number) => Uint8Array;
  readonly runCommand: (
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
  ) => Promise<string>;
  readonly spawnApp: (
    spec: AppSpec,
    output: (stream: "stdout" | "stderr", line: string) => void,
  ) => Promise<ManagedProcess>;
  readonly fetch?: typeof globalThis.fetch;
};

const allowedEnvironmentNames = new Set([
  "CI",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LANGUAGE",
  "LOGNAME",
  "NO_COLOR",
  "PATH",
  "SHELL",
  "TEMP",
  "TMP",
  "TMPDIR",
  "TZ",
  "USER",
]);

const minimalEnvironment = (source: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([name, value]) =>
        value !== undefined &&
        (allowedEnvironmentNames.has(name) || name.startsWith("LC_")),
    ),
  );

const timeoutAfter = (milliseconds: number, message: () => string) =>
  new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message())), milliseconds);
    timer.unref();
  });

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  });

const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("base64url");

const parseSeedResult = (
  raw: string,
): {
  readonly primary: SeededActor;
  readonly observer: SeededActor;
} => {
  const value: unknown = JSON.parse(raw);
  if (
    !isObject(value) ||
    !isSeededActor(value.primary) ||
    !isSeededActor(value.observer)
  ) {
    throw new Error(
      "The local contracts fixture returned invalid identifiers.",
    );
  }
  return { primary: value.primary, observer: value.observer };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isSeededActor = (value: unknown): value is SeededActor =>
  isObject(value) &&
  typeof value.keyId === "string" &&
  typeof value.workspaceId === "string" &&
  typeof value.userId === "string";

export function createContractsRuntimeController(
  dependencies: ContractsRuntimeDependencies = nodeDependencies(),
) {
  let active: ContractsRuntime | undefined;
  let activeApp: ManagedProcess | undefined;
  let starting: Promise<ContractsRuntime> | undefined;
  let stopping: Promise<void> | undefined;

  const start = (): Promise<ContractsRuntime> => {
    if (active !== undefined) return Promise.resolve(active);
    if (starting !== undefined) return starting;
    starting = bootContractsRuntime(dependencies).then(
      ({ app, runtime }) => {
        active = runtime;
        activeApp = app;
        return runtime;
      },
      (error: unknown) => {
        throw error;
      },
    );
    void starting.then(
      () => {
        starting = undefined;
      },
      () => {
        starting = undefined;
      },
    );
    return starting;
  };

  const stop = (): Promise<void> => {
    if (stopping !== undefined) return stopping;
    stopping = (async () => {
      if (starting !== undefined) await starting.catch(() => undefined);
      const runtime = active;
      const app = activeApp;
      active = undefined;
      activeApp = undefined;
      const cleanup = await Promise.allSettled([
        app?.terminate("SIGINT"),
        runtime?.browser.close(),
      ]);
      if (cleanup.some((result) => result.status === "rejected")) {
        throw new Error("Contracts runtime cleanup failed.");
      }
    })().finally(() => {
      stopping = undefined;
    });
    return stopping;
  };

  return {
    start,
    stop,
    current: () => {
      if (active === undefined) {
        throw new Error("Contracts runtime has not been started.");
      }
      return active;
    },
  };
}

async function bootContractsRuntime(
  dependencies: ContractsRuntimeDependencies,
) {
  const secrets = new Set<string>();
  const redact = (input: unknown): string => {
    let safe = input instanceof Error ? input.message : String(input);
    for (const secret of secrets) {
      if (secret !== "") safe = safe.replaceAll(secret, "[REDACTED]");
    }
    return safe
      .replace(/(Bearer\s+)[^\s]+/giu, "$1[REDACTED]")
      .replace(
        /\b([A-Z0-9_]*(?:TOKEN|API_KEY|DEPLOY_KEY|SECRET|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_]*)=\S+/giu,
        "$1=[REDACTED]",
      );
  };
  const inherited = minimalEnvironment(dependencies.environment());
  const localEnvironment = {
    ...inherited,
    CONVEX_AGENT_MODE: "anonymous",
    MAESTRO_CONTRACT_TEST: "1",
    VITE_MAESTRO_CONTRACT_MODE: "1",
  };
  const [webPort, convexPort, convexSitePort, readinessPort] =
    await Promise.all([
      dependencies.freePort(),
      dependencies.freePort(),
      dependencies.freePort(),
      dependencies.freePort(),
    ]);
  const apiBaseUrl = `http://127.0.0.1:${convexSitePort}`;
  const expectedWebUrl = `http://127.0.0.1:${webPort}`;
  let browser: Browser | undefined;
  let app: ManagedProcess | undefined;
  let output = "";
  let announcedWebUrl = "";
  let announceReady!: () => void;
  const readyAnnouncement = new Promise<void>((resolve) => {
    announceReady = resolve;
  });
  const safeOutput = () => output;

  try {
    await dependencies.runCommand(
      ["--silent", "exec", "convex", "init"],
      localEnvironment,
    );
    await dependencies.runCommand(
      [
        "--silent",
        "exec",
        "convex",
        "env",
        "set",
        "MAESTRO_CONTRACT_TEST",
        "1",
      ],
      localEnvironment,
    );
    await dependencies.runCommand(
      [
        "--silent",
        "exec",
        "convex",
        "env",
        "set",
        "POSTHOG_PROJECT_TOKEN",
        "phc_test_placeholder",
      ],
      localEnvironment,
    );
    browser = await dependencies.launchBrowser(inherited);
    app = await dependencies.spawnApp(
      {
        command: "pnpm",
        args: [
          "--silent",
          "maestro",
          "--",
          "start",
          "--mode",
          "local",
          "--web-port",
          String(webPort),
          "--convex-port",
          String(convexPort),
          "--convex-site-port",
          String(convexSitePort),
          "--readiness-port",
          String(readinessPort),
          "--details",
        ],
        cwd: dependencies.cwd,
        environment: localEnvironment,
      },
      (_stream, line) => {
        const safeLine = redact(line);
        output = `${output}${safeLine}\n`.slice(-20_000);
        const match = /^\[maestro\] URL:\s+(\S+)\s*$/u.exec(safeLine);
        if (match?.[1]) {
          announcedWebUrl = match[1];
          announceReady();
        }
      },
    );
    await Promise.race([
      readyAnnouncement,
      app.completion.then(() => {
        throw new Error(
          `maestro start exited before readiness\n${safeOutput()}`,
        );
      }),
      timeoutAfter(
        30_000,
        () => `maestro start did not announce readiness\n${safeOutput()}`,
      ),
    ]);
    if (announcedWebUrl !== expectedWebUrl) {
      throw new Error(
        `maestro start announced an unexpected URL\n${safeOutput()}`,
      );
    }

    const credentials = new WeakMap<
      ContractsScenario,
      { readonly primary: string; readonly observer: string }
    >();
    const fetcher = dependencies.fetch ?? globalThis.fetch;
    const runCommand = async (
      args: readonly string[],
      environment: NodeJS.ProcessEnv,
    ) => {
      try {
        return redact(await dependencies.runCommand(args, environment));
      } catch (error) {
        throw new Error(redact(error));
      }
    };
    const provisionScenario = async (): Promise<ContractsScenario> => {
      const nonce = Buffer.from(dependencies.randomBytes(12)).toString("hex");
      const namespace = `contracts-${nonce}`;
      const primaryKey = `mtk_live_${Buffer.from(
        dependencies.randomBytes(32),
      ).toString("base64url")}`;
      const observerKey = `mtk_live_${Buffer.from(
        dependencies.randomBytes(32),
      ).toString("base64url")}`;
      const primaryKeyHash = hashKey(primaryKey);
      const observerKeyHash = hashKey(observerKey);
      for (const value of [
        primaryKey,
        observerKey,
        primaryKeyHash,
        observerKeyHash,
      ])
        secrets.add(value);
      const seedArgs = [
        "--silent",
        "exec",
        "convex",
        "run",
        "headless/apiKeys:seedLocalContracts",
        JSON.stringify({ namespace, primaryKeyHash, observerKeyHash }),
      ];
      const deadline = Date.now() + 30_000;
      let seedOutput = "";
      while (true) {
        try {
          seedOutput = await runCommand(seedArgs, localEnvironment);
          break;
        } catch (error) {
          if (Date.now() >= deadline) throw error;
          await delay(250);
        }
      }
      const seeded = parseSeedResult(seedOutput);
      const scenario: ContractsScenario = {
        namespace,
        workspaceSlug: `${namespace}-primary`,
        observerWorkspaceSlug: `${namespace}-observer`,
        primary: seeded.primary,
        observer: seeded.observer,
      };
      credentials.set(scenario, { primary: primaryKey, observer: observerKey });
      return scenario;
    };
    const requireCredentials = (scenario: ContractsScenario) => {
      const found = credentials.get(scenario);
      if (!found) throw new Error("Contracts scenario is not provisioned.");
      return found;
    };
    const runtime: ContractsRuntime = {
      browser,
      webUrl: announcedWebUrl,
      provisionScenario,
      authorizeBrowserContext: async (scenario, context) => {
        const key = requireCredentials(scenario).primary;
        await context.route("**/__contracts/api/**", async (route) => {
          try {
            const request = route.request();
            const rawBody = request.postData();
            const body: unknown = rawBody ? JSON.parse(rawBody) : {};
            if (!isObject(body)) throw new Error("Invalid contracts request.");
            const sourceUrl = new URL(request.url());
            const targetUrl = `${apiBaseUrl}${sourceUrl.pathname.replace(
              /^\/__contracts/u,
              "",
            )}${sourceUrl.search}`;
            const response = await fetcher(targetUrl, {
              method: request.method(),
              headers: {
                authorization: `Bearer ${key}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                ...body,
                workspaceSlug: scenario.workspaceSlug,
              }),
            });
            await route.fulfill({
              status: response.status,
              contentType:
                response.headers.get("content-type") ?? "application/json",
              body: Buffer.from(await response.arrayBuffer()),
            });
          } catch {
            await route.fulfill({
              status: 502,
              contentType: "application/json",
              body: JSON.stringify({
                ok: false,
                error: { message: "Contract request forwarding failed." },
              }),
            });
          }
        });
      },
      runCli: (scenario, args, actor = "primary") => {
        const scenarioCredentials = requireCredentials(scenario);
        return runCommand(["--silent", "maestro", "--", ...args], {
          ...localEnvironment,
          MAESTRO_API_BASE_URL: apiBaseUrl,
          MAESTRO_API_KEY: actor === "none" ? "" : scenarioCredentials[actor],
        });
      },
    };
    return { app, runtime };
  } catch (error) {
    await Promise.allSettled([app?.terminate("SIGINT"), browser?.close()]);
    throw new Error(redact(error));
  }
}

function nodeDependencies(): ContractsRuntimeDependencies {
  const cwd = process.cwd();
  return {
    cwd,
    environment: () => process.env,
    freePort: () =>
      new Promise<number>((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (address === null || typeof address === "string") {
            server.close();
            reject(new Error("Could not reserve a local contract port."));
            return;
          }
          server.close(() => resolve(address.port));
        });
      }),
    launchBrowser: (environment) =>
      chromium.launch({ headless: true, env: stringEnvironment(environment) }),
    randomBytes: (size) => randomBytes(size),
    runCommand: (args, environment) =>
      new Promise<string>((resolve, reject) => {
        execFile(
          "pnpm",
          [...args],
          { cwd, env: environment, encoding: "utf8" },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`${error.message}\n${stdout}\n${stderr}`));
              return;
            }
            resolve(stdout);
          },
        );
      }),
    spawnApp: (spec, output) => spawnManagedProcess(spec, output),
  };
}

async function spawnManagedProcess(
  spec: AppSpec,
  output: (stream: "stdout" | "stderr", line: string) => void,
): Promise<ManagedProcess> {
  const child = spawn(spec.command, [...spec.args], {
    cwd: spec.cwd,
    env: spec.environment,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    detached: process.platform !== "win32",
  });
  const started = new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  const completion = new Promise<{
    readonly code: number | null;
    readonly signal: string | null;
  }>((resolve) => {
    child.once("error", () => resolve({ code: null, signal: null }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  pipeLines(child.stdout, (line) => output("stdout", line));
  pipeLines(child.stderr, (line) => output("stderr", line));
  await started;
  const signalTree = (signal: NodeJS.Signals) => {
    const pid = child.pid;
    if (pid === undefined) {
      child.kill(signal);
      return;
    }
    try {
      process.kill(process.platform === "win32" ? pid : -pid, signal);
    } catch {
      child.kill(signal);
    }
  };
  return {
    completion,
    terminate: async (signal) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      signalTree(signal);
      const stopped = await Promise.race([
        completion.then(() => true),
        new Promise<false>((resolve) => {
          const timer = setTimeout(() => resolve(false), 2_000);
          timer.unref();
        }),
      ]);
      if (!stopped && child.exitCode === null && child.signalCode === null) {
        signalTree("SIGKILL");
      }
    },
  };
}

const pipeLines = (
  stream: NodeJS.ReadableStream | null,
  output: (line: string) => void,
) => {
  if (stream === null) return;
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/u);
    pending = lines.pop() ?? "";
    for (const line of lines) output(line);
  });
  stream.on("end", () => {
    if (pending !== "") output(pending);
  });
};

const stringEnvironment = (
  environment: NodeJS.ProcessEnv,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );

const defaultController = createContractsRuntimeController();

export const startContractsRuntime = () => defaultController.start();
export const stopContractsRuntime = () => defaultController.stop();
export const contractsRuntime = () => defaultController.current();
