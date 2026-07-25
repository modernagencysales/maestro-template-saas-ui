import { resolve } from "node:path";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
  type AgentPackExecutionContext,
} from "./contracts.js";
import {
  inspectStartPorts,
  startPortPlan,
  type StartMode,
  type StartPortProbe,
} from "./ports.js";
import type {
  ProcessCompletion,
  StartProcessSpec,
} from "./processSupervisor.js";
import type { PreflightMode } from "./preflight.js";

export type StartPreflightResult = {
  readonly safeToStart: boolean;
  readonly auth: "not-required" | "connected" | "cancelled";
  readonly diagnostics: readonly AgentPackDiagnostic[];
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
  ) => Promise<ProcessCompletion>;
};

const modes = new Set<StartMode>(["fake", "local", "dev"]);

export function createStartCommand(dependencies: StartDependencies) {
  return defineAgentPackCommand({
    id: "start",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeStartInput,
    mutationPosture: () => "read-only",
    execute: async ({ mode }, context) => {
      const preflight = await dependencies.preflight(
        preflightMode(mode),
        context,
      );
      if (!preflight.safeToStart) {
        return failure(
          "Preflight blocked local start before any process was spawned.",
          preflight.diagnostics.map(blockingDiagnostic),
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
      const ports = startPortPlan(mode);
      const portInspection = await inspectStartPorts(ports, dependencies.ports);
      if (!portInspection.ok) {
        const occupied = portInspection.collisions
          .map(({ id, port }) => `${id}:${port}`)
          .join(", ");
        return failure("Start ports are already in use.", [
          diagnostic(
            "AGENT_PACK_START_PORT_COLLISION",
            `Required local ports are occupied: ${occupied}.`,
            "Stop the occupying processes or choose the fallback commands manually.",
            `pnpm maestro -- start --mode ${mode}`,
          ),
        ]);
      }
      const identity = await readIdentity(
        dependencies,
        context.repo.targetRoot,
      );
      if (!identity.ok) return failure(identity.summary, [identity.diagnostic]);
      const specs = processPlan(mode, context.repo.targetRoot, ports.web);
      const completion = await dependencies.supervise(specs);
      if (completion.code !== null && completion.code !== 0) {
        return failure("A local start process exited unexpectedly.", [
          diagnostic(
            "AGENT_PACK_START_PROCESS_FAILED",
            `A local child process exited with code ${completion.code}. All siblings were stopped.`,
            "Review the grouped logs and repair the first failing process.",
            `pnpm maestro -- start --mode ${mode}`,
          ),
        ]);
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
          processes: specs.map(({ id }) => id),
          stoppedBy: completion.signal,
        },
      };
    },
  });
}

function decodeStartInput(
  input: unknown,
): AgentPackArgumentResult<{ readonly mode: StartMode }> {
  if (record(input)) {
    const keys = Object.keys(input);
    const mode = input.mode ?? "fake";
    if (keys.every((key) => key === "mode") && modes.has(mode as StartMode)) {
      return { ok: true, args: { mode: mode as StartMode } };
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

function preflightMode(mode: StartMode): PreflightMode {
  return mode === "fake" ? "fake" : mode === "local" ? "test" : "live";
}

function processPlan(
  mode: StartMode,
  cwd: string,
  webPort: number,
): readonly StartProcessSpec[] {
  const web: StartProcessSpec = {
    id: "web",
    command: "pnpm",
    args: [
      "--dir",
      "apps/web",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
      "--strictPort",
    ],
    cwd,
  };
  if (mode === "fake") return [web];
  if (mode === "local") {
    return [
      {
        id: "convex",
        command: "pnpm",
        args: ["--dir", "packages/convex", "convex:dev", "--", "--local"],
        cwd,
      },
      {
        id: "confect",
        command: "pnpm",
        args: ["--dir", "packages/convex", "confect:dev"],
        cwd,
      },
      web,
    ];
  }
  return [{ id: "backend", command: "pnpm", args: ["dev:backend"], cwd }, web];
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

function failure(summary: string, diagnostics: readonly AgentPackDiagnostic[]) {
  return {
    mutationPosture: "read-only" as const,
    exitClass: "unavailableDependency" as const,
    summary,
    diagnostics,
    data: null,
  };
}

function blockingDiagnostic(value: AgentPackDiagnostic): AgentPackDiagnostic {
  return { ...value, severity: "error", safeToContinue: false };
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
