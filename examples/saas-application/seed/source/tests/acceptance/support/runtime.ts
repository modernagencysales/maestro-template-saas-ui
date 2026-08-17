import {
  chromium,
  type Browser,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import { spawn } from "node:child_process";
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
  readonly apiBaseUrl: string;
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

type ManagedCommand = {
  readonly completion: Promise<{
    readonly code: number | null;
    readonly signal: string | null;
    readonly stdout: string;
    readonly stderr: string;
  }>;
  readonly terminate: (signal: NodeJS.Signals) => Promise<void>;
};

type RuntimeResources = {
  readonly commands: Set<ManagedCommand>;
  readonly commandTerminations: Map<ManagedCommand, Promise<void>>;
  readonly cancelled: Promise<void>;
  readonly cancel: () => void;
  cleanup: Promise<void> | undefined;
  app: ManagedProcess | undefined;
  browser: Browser | undefined;
  stopping: boolean;
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
  ) => Promise<ManagedCommand>;
  readonly spawnApp: (
    spec: AppSpec,
    output: (stream: "stdout" | "stderr", line: string) => void,
  ) => Promise<ManagedProcess>;
  readonly commandTimeoutMs?: number;
  readonly startupTimeoutMs?: number;
  readonly seedTimeoutMs?: number;
  readonly readinessTimeoutMs?: number;
  readonly retryDelayMs?: number;
};

type ProxyInput = {
  readonly requestRoute: Route;
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly workspaceSlug: string;
};

export const proxyContractsRequest = async ({
  requestRoute: route,
  apiBaseUrl,
  apiKey,
  workspaceSlug,
}: ProxyInput): Promise<void> => {
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
    const response = await route.fetch({
      method: request.method(),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      postData: JSON.stringify({ ...body, workspaceSlug }),
      url: targetUrl,
    });
    await route.fulfill({ response });
  } catch {
    await route.fulfill({ status: 502 });
  }
};

export const redactContractsDiagnostic = (
  input: unknown,
  secrets: readonly string[] = [],
): string => {
  let safe = input instanceof Error ? input.message : String(input);
  for (const secret of secrets) {
    if (secret !== "") safe = safe.replaceAll(secret, "[REDACTED]");
  }
  safe = safe
    .replace(
      /(\b(?:authorization|set-cookie|cookie)\s*:\s*)[^\r\n]+/giu,
      "$1[REDACTED]",
    )
    .replace(
      /(["'](?:authorization|cookie|set-cookie)["']\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/giu,
      (_match, prefix: string, value: string) =>
        `${prefix}${value[0]}[REDACTED]${value[0]}`,
    )
    .replace(/(Bearer\s+)[^\s]+/giu, "$1[REDACTED]")
    .replace(
      /((?:["']?[A-Z0-9_-]{0,64}(?:TOKEN|API[_-]?KEY|DEPLOY[_-]?KEY|SECRET|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_-]{0,64}["']?)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/giu,
      (_match, prefix: string, value: string) => {
        const quote = value.startsWith('"')
          ? '"'
          : value.startsWith("'")
            ? "'"
            : "";
        return `${prefix}${quote}[REDACTED]${quote}`;
      },
    );
  return safe.slice(-19_900);
};

export const CONTRACTS_RUNTIME_STARTUP_TIMEOUT_MS = 120_000;
export const CONTRACTS_HOOK_TIMEOUT_MS = 150_000;

const allowedEnvironmentNames = new Set([
  "CI",
  "HOME",
  "LANG",
  "LANGUAGE",
  "LC_ADDRESS",
  "LC_ALL",
  "LC_COLLATE",
  "LC_CTYPE",
  "LC_IDENTIFICATION",
  "LC_MEASUREMENT",
  "LC_MESSAGES",
  "LC_MONETARY",
  "LC_NAME",
  "LC_NUMERIC",
  "LC_PAPER",
  "LC_TELEPHONE",
  "LC_TIME",
  "LOGNAME",
  "NO_COLOR",
  "NODE_EXTRA_CA_CERTS",
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
        value !== undefined && allowedEnvironmentNames.has(name),
    ),
  );

const timeoutAfter = (milliseconds: number, message: () => string) =>
  new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message())), milliseconds);
    timer.unref();
  });

const withTimeout = async <Value>(
  operation: Promise<Value>,
  milliseconds: number,
  message: () => string,
  onTimeout?: () => void,
): Promise<Value> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } finally {
        reject(new Error(message()));
      }
    }, milliseconds);
    timer.unref();
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

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
  let starting: Promise<ContractsRuntime> | undefined;
  let stopping: Promise<void> | undefined;
  let resources: RuntimeResources | undefined;

  const start = (): Promise<ContractsRuntime> => {
    if (active !== undefined) return Promise.resolve(active);
    if (starting !== undefined) return starting;
    const owned = createRuntimeResources();
    resources = owned;
    const startup = (async () => {
      try {
        const runtime = await bootContractsRuntime(dependencies, owned);
        if (owned.stopping) throw new Error("Contracts runtime was stopped.");
        active = runtime;
        return runtime;
      } catch (error) {
        owned.stopping = true;
        owned.cancel();
        let cleanupFailure: unknown;
        try {
          await cleanupResources(owned);
        } catch (cleanupError) {
          cleanupFailure = cleanupError;
        }
        const cleanupContext =
          cleanupFailure === undefined ? "" : `\n${String(cleanupFailure)}`;
        throw new Error(`${String(error)}${cleanupContext}`);
      }
    })();
    const attempt = withTimeout(
      startup,
      dependencies.startupTimeoutMs ?? CONTRACTS_RUNTIME_STARTUP_TIMEOUT_MS,
      () => "Contracts runtime startup timed out.",
      () => {
        owned.stopping = true;
        owned.cancel();
        void cleanupResources(owned).catch(() => undefined);
      },
    );
    starting = attempt;
    void attempt.then(
      () => {
        if (starting === attempt) starting = undefined;
      },
      () => {
        if (starting === attempt) starting = undefined;
      },
    );
    return attempt;
  };

  const stop = (): Promise<void> => {
    if (stopping !== undefined) return stopping;
    stopping = (async () => {
      const owned = resources;
      if (owned !== undefined) {
        owned.stopping = true;
        owned.cancel();
        await cleanupResources(owned);
      }
      if (starting !== undefined) await starting.catch(() => undefined);
      const runtime = active;
      active = undefined;
      if (owned !== undefined) {
        await cleanupResources(owned);
        resources = undefined;
      } else if (runtime !== undefined) {
        await runtime.browser.close();
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
  resources: RuntimeResources,
) {
  const secrets = new Set<string>();
  const redact = (input: unknown): string =>
    redactContractsDiagnostic(input, [...secrets]);
  const inherited = minimalEnvironment(dependencies.environment());
  const [webPort, convexPort, convexSitePort, readinessPort] =
    await Promise.all([
      dependencies.freePort(),
      dependencies.freePort(),
      dependencies.freePort(),
      dependencies.freePort(),
    ]);
  const apiBaseUrl = `http://127.0.0.1:${convexSitePort}`;
  const expectedWebUrl = `http://127.0.0.1:${webPort}`;
  const localEnvironment = {
    ...inherited,
    CONVEX_AGENT_MODE: "anonymous",
    MAESTRO_CONTRACT_TEST: "1",
    VITE_MAESTRO_CONTRACT_MODE: "1",
    WORKOS_API_KEY: "fake",
    WORKOS_CLIENT_ID: "client_test_contracts_runtime",
    WORKOS_COOKIE_PASSWORD: "contracts-runtime-test-cookie-password",
    WORKOS_REDIRECT_URI: `${expectedWebUrl}/api/auth/callback`,
  };
  let output = "";
  let announcedWebUrl = "";
  let announceReady: (() => void) | undefined;
  const readyAnnouncement = new Promise<void>((resolve) => {
    announceReady = resolve;
  });
  const safeOutput = () => output;
  const ensureRunning = () => {
    if (resources.stopping) throw new Error("Contracts runtime was stopped.");
  };
  const executeCommand = async (
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
    timeoutMs: number,
  ) => {
    ensureRunning();
    const command = await dependencies.runCommand(args, environment);
    resources.commands.add(command);
    try {
      ensureRunning();
      const result = await Promise.race([
        command.completion,
        resources.cancelled.then(() => {
          throw new Error("Contracts runtime was stopped.");
        }),
        timeoutAfter(timeoutMs, () => "Contracts command timed out."),
      ]);
      if (result.code !== 0) {
        throw new Error(
          `Contracts command failed (${result.code ?? result.signal ?? "unknown"}).\n${result.stdout}\n${result.stderr}`,
        );
      }
      resources.commands.delete(command);
      return redact(result.stdout);
    } catch (error) {
      await terminateTrackedCommand(resources, command);
      resources.commands.delete(command);
      throw new Error(redact(error));
    }
  };
  const commandTimeoutMs = dependencies.commandTimeoutMs ?? 120_000;
  const seedTimeoutMs = dependencies.seedTimeoutMs ?? 120_000;
  const readinessTimeoutMs =
    dependencies.readinessTimeoutMs ?? CONTRACTS_RUNTIME_STARTUP_TIMEOUT_MS;
  const retryDelayMs = dependencies.retryDelayMs ?? 250;

  try {
    const browser = await dependencies.launchBrowser(inherited);
    if (resources.stopping) {
      await browser.close();
      throw new Error("Contracts runtime was stopped.");
    }
    resources.browser = browser;
    ensureRunning();
    const app = await dependencies.spawnApp(
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
          announceReady?.();
        }
      },
    );
    if (resources.stopping) {
      await app.terminate("SIGINT");
      throw new Error("Contracts runtime was stopped.");
    }
    resources.app = app;
    ensureRunning();
    await Promise.race([
      readyAnnouncement,
      app.completion.then(() => {
        throw new Error(
          `maestro start exited before readiness\n${safeOutput()}`,
        );
      }),
      resources.cancelled.then(() => {
        throw new Error("Contracts runtime was stopped.");
      }),
      timeoutAfter(
        readinessTimeoutMs,
        () => `maestro start did not announce readiness\n${safeOutput()}`,
      ),
    ]);
    if (announcedWebUrl !== expectedWebUrl) {
      throw new Error(
        `maestro start announced an unexpected URL\n${safeOutput()}`,
      );
    }
    for (const [name, value] of [
      ["MAESTRO_CONTRACT_TEST", "1"],
      ["POSTHOG_PROJECT_TOKEN", "phc_test_placeholder"],
      ["WORKOS_CLIENT_ID", "client_test_contracts_runtime"],
    ] as const) {
      await executeCommand(
        ["--silent", "exec", "convex", "env", "set", name, value],
        localEnvironment,
        commandTimeoutMs,
      );
    }
    const credentials = new WeakMap<
      ContractsScenario,
      { readonly primary: string; readonly observer: string }
    >();
    const runCommand = async (
      args: readonly string[],
      environment: NodeJS.ProcessEnv,
      timeoutMs = commandTimeoutMs,
    ) => {
      try {
        return await executeCommand(args, environment, timeoutMs);
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
      const deadline = Date.now() + seedTimeoutMs;
      let seedOutput = "";
      while (true) {
        try {
          const remaining = Math.max(1, deadline - Date.now());
          seedOutput = await runCommand(
            seedArgs,
            localEnvironment,
            Math.min(commandTimeoutMs, remaining),
          );
          break;
        } catch (error) {
          ensureRunning();
          if (Date.now() >= deadline) throw error;
          await Promise.race([
            delay(retryDelayMs),
            resources.cancelled.then(() => {
              throw new Error("Contracts runtime was stopped.");
            }),
          ]);
          ensureRunning();
        }
      }
      const seeded = parseSeedResult(seedOutput);
      const scenario: ContractsScenario = Object.freeze({
        namespace,
        workspaceSlug: `${namespace}-primary`,
        observerWorkspaceSlug: `${namespace}-observer`,
        primary: Object.freeze(seeded.primary),
        observer: Object.freeze(seeded.observer),
      });
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
      apiBaseUrl,
      provisionScenario,
      authorizeBrowserContext: async (scenario, context) => {
        const key = requireCredentials(scenario).primary;
        await context.route("**/__contracts/api/**", (route) =>
          proxyContractsRequest({
            requestRoute: route,
            apiBaseUrl,
            apiKey: key,
            workspaceSlug: scenario.workspaceSlug,
          }),
        );
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
    return Object.freeze(runtime);
  } catch (error) {
    throw new Error(redact(error));
  }
}

function cleanupResources(resources: RuntimeResources): Promise<void> {
  if (resources.cleanup !== undefined) return resources.cleanup;
  const cleanup = performCleanup(resources);
  resources.cleanup = cleanup;
  return cleanup;
}

async function performCleanup(resources: RuntimeResources) {
  const commands = [...resources.commands];
  const app = resources.app;
  const browser = resources.browser;
  const targets: Array<{
    readonly label: string;
    readonly cleanup: () => Promise<void>;
    readonly clear: () => void;
  }> = commands.map((command) => ({
    label: "command process",
    cleanup: () => terminateTrackedCommand(resources, command),
    clear: () => resources.commands.delete(command),
  }));
  if (app !== undefined) {
    targets.push({
      label: "app process",
      cleanup: () => app.terminate("SIGINT"),
      clear: () => {
        if (resources.app === app) resources.app = undefined;
      },
    });
  }
  if (browser !== undefined) {
    targets.push({
      label: "browser",
      cleanup: () => browser.close(),
      clear: () => {
        if (resources.browser === browser) resources.browser = undefined;
      },
    });
  }
  const cleanup = await Promise.allSettled(
    targets.map((target) => target.cleanup()),
  );
  const failedLabels: string[] = [];
  for (const [index, result] of cleanup.entries()) {
    const target = targets[index];
    if (target === undefined) continue;
    if (result.status === "fulfilled") target.clear();
    else failedLabels.push(target.label);
  }
  if (failedLabels.length > 0) {
    throw new Error(
      `Contracts runtime cleanup failed: ${failedLabels
        .map((label) => `${label} cleanup failed`)
        .join(", ")}.`,
    );
  }
}

function terminateTrackedCommand(
  resources: RuntimeResources,
  command: ManagedCommand,
) {
  const inFlight = resources.commandTerminations.get(command);
  if (inFlight !== undefined) return inFlight;
  const attempt = Promise.resolve().then(() => command.terminate("SIGINT"));
  resources.commandTerminations.set(command, attempt);
  const clearAttempt = () => {
    if (resources.commandTerminations.get(command) === attempt) {
      resources.commandTerminations.delete(command);
    }
  };
  void attempt.then(clearAttempt, clearAttempt);
  return attempt;
}

function createRuntimeResources(): RuntimeResources {
  let cancel: () => void = () => undefined;
  const cancelled = new Promise<void>((resolve) => {
    cancel = resolve;
  });
  return {
    commands: new Set(),
    commandTerminations: new Map(),
    cancelled,
    cancel,
    cleanup: undefined,
    app: undefined,
    browser: undefined,
    stopping: false,
  };
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
      spawnManagedCommand({
        command: "pnpm",
        args,
        cwd,
        environment,
      }),
    spawnApp: (spec, output) => spawnManagedProcess(spec, output),
  };
}

export async function spawnManagedCommand(
  spec: AppSpec,
): Promise<ManagedCommand> {
  let stdout = "";
  let stderr = "";
  const process = await spawnManagedProcess(spec, (stream, line) => {
    if (stream === "stdout") stdout = `${stdout}${line}\n`.slice(-20_000);
    else stderr = `${stderr}${line}\n`.slice(-20_000);
  });
  return {
    completion: process.completion.then((result) => ({
      ...result,
      stdout,
      stderr,
    })),
    terminate: process.terminate,
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
    child.once("close", (code, signal) => resolve({ code, signal }));
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
        const killed = await Promise.race([
          completion.then(() => true),
          new Promise<false>((resolve) => {
            const timer = setTimeout(() => resolve(false), 2_000);
            timer.unref();
          }),
        ]);
        if (!killed) throw new Error("Child process did not terminate.");
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
