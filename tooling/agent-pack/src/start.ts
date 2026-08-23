import { resolve } from "node:path";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
  type AgentPackExecutionContext,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { AgentPackExitClass } from "./exitCodes.js";
import {
  inspectStartPorts,
  startPortPlan,
  type StartMode,
  type StartPort,
  type StartPortOverrides,
  type StartPortPlan,
  type StartPortProbe,
} from "./ports.js";
import type {
  ProcessSupervisionResult,
  StartProcessSpec,
} from "./processSupervisor.js";
import type { PreflightMode } from "./preflight.js";
import type { RepositoryContext } from "./repoContext.js";

export type StartPreflightResult = {
  readonly safeToStart: boolean;
  readonly auth: "not-required" | "connected" | "cancelled" | "unknown";
  readonly exitClass: AgentPackExitClass;
  readonly diagnostics: readonly AgentPackDiagnostic[];
  readonly readiness: {
    readonly worksNow: string;
    readonly demoOnly: string;
    readonly blueprint: string;
    readonly providers: readonly {
      readonly id: string;
      readonly posture: "sample" | "local" | "test" | "live" | "missing";
    }[];
  };
};
export type StartDependencies = {
  readonly preflight: (
    mode: PreflightMode,
    context: AgentPackExecutionContext,
  ) => Promise<StartPreflightResult>;
  readonly readFile: (path: string) => Promise<string>;
  readonly ports: StartPortProbe;
  readonly supervise: (
    specs: readonly StartProcessSpec[],
    readiness: {
      readonly wait: (signal: AbortSignal) => Promise<boolean>;
      readonly onReady: () => void;
    },
  ) => Promise<ProcessSupervisionResult>;
  readonly readiness: {
    readonly wait: (url: string, signal: AbortSignal) => Promise<boolean>;
  };
  readonly readinessSurface: {
    readonly open: (input: {
      readonly mode: StartMode;
      readonly port: number;
      readonly repo: RepositoryContext;
      readonly preflight: StartPreflightResult;
    }) => Promise<{
      readonly url: string;
      readonly close: () => Promise<void>;
    }>;
  };
  readonly announce: (facts: {
    readonly name: string;
    readonly firstOutcome: string;
    readonly url: string;
    readonly readinessUrl: string;
    readonly buildReadinessUrl: string;
  }) => void;
};

const modes = new Set<StartMode>(["fake", "local", "dev"]);
const portOverrideKeys = new Set<keyof StartPortOverrides>([
  "web",
  "convex",
  "convexSite",
  "readinessPresenter",
]);

export type StartInput = {
  readonly mode: StartMode;
  readonly ports?: StartPortOverrides;
};

export function createStartCommand(dependencies: StartDependencies) {
  return defineAgentPackCommand({
    id: "start",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeStartInput,
    mutationPosture: () => "read-only",
    execute: async ({ mode, ports: overrides }, context) => {
      const preflight = await dependencies.preflight(
        preflightMode(mode),
        context,
      );
      if (!preflight.safeToStart) {
        return failure(
          "Preflight blocked local start before any process was spawned.",
          preflight.diagnostics,
          preflight.exitClass,
        );
      }
      if (mode === "dev" && preflight.auth !== "connected") {
        return failure("Dev start requires a personal Convex deployment.", [
          diagnostic(
            "AGENT_PACK_START_DEV_AUTH_REQUIRED",
            "Connect an authenticated personal Convex dev deployment; production is never selected by start.",
            "Authenticate with Convex for a personal dev deployment.",
            "pnpm maestro -- start --mode dev",
          ),
        ]);
      }
      const ports = startPortPlan(mode, overrides);
      const portInspection = await inspectStartPorts(ports, dependencies.ports);
      if (!portInspection.ok) {
        const occupied = portInspection.collisions
          .map(({ id, port }) => `${id}:${port}`)
          .join(", ");
        const rerun = collisionRerun(mode, ports, portInspection.collisions);
        return failure(
          "Start ports are already in use.",
          [
            diagnostic(
              "AGENT_PACK_START_PORT_COLLISION",
              `Required local ports are occupied: ${occupied}.`,
              "Leave unknown port owners running and retry on the reviewed alternate ports.",
              rerun,
            ),
          ],
          "blockedMutation",
          { collisions: portInspection.collisions, rerun },
        );
      }
      const identity = await readIdentity(
        dependencies,
        context.repo.targetRoot,
      );
      if (!identity.ok) return failure(identity.summary, [identity.diagnostic]);
      let surface: Awaited<
        ReturnType<StartDependencies["readinessSurface"]["open"]>
      >;
      try {
        surface = await dependencies.readinessSurface.open({
          mode,
          port: ports.readinessPresenter,
          repo: context.repo,
          preflight,
        });
      } catch {
        return failure("The local Build Readiness surface was unavailable.", [
          diagnostic(
            "AGENT_PACK_START_READINESS_SURFACE_UNAVAILABLE",
            "The localhost-only Build Readiness presenter could not start.",
            "Free the reviewed loopback port and inspect canonical readiness artifacts.",
            `pnpm maestro -- start --mode ${mode}`,
          ),
        ]);
      }
      const specs = processPlan(mode, context.repo.targetRoot, ports);
      let supervision: ProcessSupervisionResult;
      let closeFailed = false;
      try {
        supervision = await dependencies.supervise(specs, {
          wait: (signal) =>
            dependencies.readiness.wait(ports.readinessUrl, signal),
          onReady: () =>
            dependencies.announce({
              ...identity.app,
              url: ports.url,
              readinessUrl: ports.readinessUrl,
              buildReadinessUrl: surface.url,
            }),
        });
      } finally {
        try {
          await surface.close();
        } catch {
          closeFailed = true;
        }
      }
      if (closeFailed)
        return failure("The local Build Readiness surface did not close.", [
          diagnostic(
            "AGENT_PACK_START_READINESS_SURFACE_CLEANUP",
            "The localhost readiness presenter exceeded its cleanup boundary.",
            "Stop the local process and confirm the loopback port is free.",
            `pnpm maestro -- start --mode ${mode}`,
          ),
        ]);
      if (supervision.kind !== "user-signal") {
        return supervisionFailure(supervision, mode);
      }
      return {
        mutationPosture: "read-only" as const,
        exitClass: "success" as const,
        summary: `${identity.app.name} stopped cleanly.`,
        diagnostics: [],
        data: {
          mode,
          app: identity.app,
          url: ports.url,
          readinessUrl: ports.readinessUrl,
          buildReadinessUrl: surface.url,
          ports: ports.required,
          processes: specs.map(({ id }) => id),
          stoppedBy: supervision.signal,
        },
      };
    },
  });
}

function decodeStartInput(input: unknown): AgentPackArgumentResult<StartInput> {
  if (record(input)) {
    const keys = Object.keys(input);
    const mode = input.mode ?? "fake";
    if (
      keys.every((key) => key === "mode" || key === "ports") &&
      modes.has(mode as StartMode)
    ) {
      if (!validPortOverrides(input.ports)) return invalidStartPorts();
      const ports = input.ports as StartPortOverrides | undefined;
      try {
        startPortPlan(mode as StartMode, ports);
        return {
          ok: true,
          args: {
            mode: mode as StartMode,
            ...(ports === undefined ? {} : { ports }),
          },
        };
      } catch {
        return invalidStartPorts();
      }
    }
  }
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "AGENT_PACK_START_INVALID_MODE",
        "Start mode must be fake, local, or dev; preview, staging, and production use promotion commands.",
        "Choose fake, local, or dev.",
        "pnpm maestro -- start --mode fake",
      ),
    ],
  };
}

function validPortOverrides(value: unknown): boolean {
  if (value === undefined) return true;
  return (
    record(value) &&
    Object.keys(value).every((key) =>
      portOverrideKeys.has(key as keyof StartPortOverrides),
    ) &&
    Object.values(value).every(
      (port) =>
        typeof port === "number" &&
        Number.isInteger(port) &&
        port >= 1024 &&
        port <= 65_535,
    )
  );
}

function invalidStartPorts(): AgentPackArgumentResult<StartInput> {
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "AGENT_PACK_START_INVALID_PORTS",
        "Start ports must be unique integers from 1024 through 65535.",
        "Choose distinct unprivileged ports for the selected mode.",
        "pnpm maestro -- start --mode fake --web-port 15173 --readiness-port 14174",
      ),
    ],
  };
}

function preflightMode(mode: StartMode): PreflightMode {
  return mode === "dev" ? "live" : "fake";
}

function processPlan(
  mode: StartMode,
  cwd: string,
  ports: StartPortPlan,
): readonly StartProcessSpec[] {
  const convexPort = requiredPort(ports, "convex", 3210);
  const convexSitePort = requiredPort(ports, "convex-site", 3211);
  const isolated = isolatedConvexEnvironment(
    mode === "local" ? `http://127.0.0.1:${convexPort}` : "",
  );
  const localBackend = isolatedConvexEnvironment("");
  const fixtureWebEnvironment = {
    ...isolated,
    set: {
      ...isolated.set,
      APP_ENV: "fake",
      APP_PROVIDER_MODE: "fake",
      VITE_MAESTRO_AUTH_MODE: "fixture",
    },
  };
  const web: StartProcessSpec = {
    id: "web",
    command: "pnpm",
    args: [
      "--dir",
      "apps/web",
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(ports.web),
      "--strictPort",
    ],
    cwd,
    ...(mode === "dev" ? {} : { environment: fixtureWebEnvironment }),
  };
  if (mode === "fake") return [web];
  if (mode === "local") {
    return [
      {
        id: "convex",
        command: "pnpm",
        args: [
          "--dir",
          "packages/convex",
          "convex:dev",
          "--local-cloud-port",
          String(convexPort),
          "--local-site-port",
          String(convexSitePort),
          "--typecheck",
          "disable",
        ],
        cwd,
        environment: {
          ...localBackend,
          set: { ...localBackend.set, CONVEX_AGENT_MODE: "anonymous" },
        },
      },
      {
        id: "confect",
        command: "pnpm",
        args: ["--dir", "packages/convex", "confect:dev"],
        cwd,
        environment: localBackend,
      },
      web,
    ];
  }
  return [{ id: "backend", command: "pnpm", args: ["dev:backend"], cwd }, web];
}

function requiredPort(
  plan: StartPortPlan,
  id: StartPort["id"],
  fallback: number,
): number {
  return (
    plan.required.find((candidate) => candidate.id === id)?.port ?? fallback
  );
}

function collisionRerun(
  mode: StartMode,
  plan: StartPortPlan,
  collisions: readonly StartPort[],
): string {
  const occupied = new Set(collisions.map(({ id }) => id));
  const alternates: Readonly<Record<StartPort["id"], number>> = {
    web: 15_173,
    convex: 13_210,
    "convex-site": 13_211,
    "readiness-presenter": 14_174,
  };
  const flags: Readonly<Record<StartPort["id"], string>> = {
    web: "--web-port",
    convex: "--convex-port",
    "convex-site": "--convex-site-port",
    "readiness-presenter": "--readiness-port",
  };
  const overrides = plan.required.flatMap(({ id, port }) => [
    flags[id],
    String(occupied.has(id) ? alternates[id] : port),
  ]);
  return ["pnpm", "maestro", "--", "start", "--mode", mode, ...overrides].join(
    " ",
  );
}

function isolatedConvexEnvironment(
  viteUrl: string,
): NonNullable<StartProcessSpec["environment"]> {
  const selectors = [
    "CONVEX_DEPLOYMENT",
    "CONVEX_DEPLOY_KEY",
    "TEMPLATE_CONVEX_DEPLOY_KEY",
    "CONVEX_URL",
    "CONVEX_SITE_URL",
    "CONVEX_SELF_HOSTED_URL",
    "CONVEX_SELF_HOSTED_ADMIN_KEY",
    "VITE_CONVEX_URL",
  ];
  return {
    remove: selectors,
    set: {
      ...Object.fromEntries(selectors.map((name) => [name, ""])),
      VITE_CONVEX_URL: viteUrl,
    },
  };
}

async function readIdentity(
  dependencies: StartDependencies,
  targetRoot: string,
): Promise<
  | {
      readonly ok: true;
      readonly app: { readonly name: string; readonly firstOutcome: string };
    }
  | {
      readonly ok: false;
      readonly summary: string;
      readonly diagnostic: AgentPackDiagnostic;
    }
> {
  try {
    const value: unknown = JSON.parse(
      await dependencies.readFile(
        resolve(targetRoot, "template-instance.json"),
      ),
    );
    const personalization = record(value) ? value.personalization : undefined;
    if (
      record(personalization) &&
      nonempty(personalization.name) &&
      nonempty(personalization.firstOutcome)
    ) {
      return {
        ok: true,
        app: {
          name: personalization.name,
          firstOutcome: personalization.firstOutcome,
        },
      };
    }
  } catch {
    // The closed diagnostic below covers unreadable and malformed instances.
  }
  return {
    ok: false,
    summary: "Customer target identity is unavailable.",
    diagnostic: diagnostic(
      "AGENT_PACK_START_INSTANCE_INVALID",
      "template-instance.json must contain the personalized app name and first outcome.",
      "Run start from a completed customer target.",
      "pnpm maestro -- start --mode fake",
    ),
  };
}

function failure(
  summary: string,
  diagnostics: readonly AgentPackDiagnostic[],
  exitClass: AgentPackExitClass = "unavailableDependency",
  data: AgentPackJsonValue = null,
) {
  return {
    mutationPosture: "read-only" as const,
    exitClass,
    summary,
    diagnostics,
    data,
  };
}

function supervisionFailure(
  result: Exclude<ProcessSupervisionResult, { readonly kind: "user-signal" }>,
  mode: StartMode,
) {
  const details =
    result.kind === "child-exit"
      ? result.completion.signal === null
        ? `A child exited with code ${result.completion.code ?? "unknown"}.`
        : `A child exited from unsolicited signal ${result.completion.signal}.`
      : result.kind === "readiness-timeout"
        ? "The readiness route did not become healthy before timeout."
        : result.kind === "readiness-failed"
          ? "The readiness route could not be observed."
          : result.kind === "cleanup-timeout"
            ? "Child cleanup exceeded its hard deadline after termination."
            : "A required local executable could not be spawned.";
  return failure("Local start was unavailable; every child was stopped.", [
    diagnostic(
      `AGENT_PACK_START_${result.kind.replaceAll("-", "_").toUpperCase()}`,
      details,
      "Review the grouped logs and repair the first unavailable dependency.",
      `pnpm maestro -- start --mode ${mode}`,
    ),
  ]);
}

function diagnostic(
  code: string,
  message: string,
  nextAction: string,
  rerun: string,
): AgentPackDiagnostic {
  return {
    code,
    severity: "error",
    message,
    safeToContinue: false,
    nextAction,
    rerun,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
