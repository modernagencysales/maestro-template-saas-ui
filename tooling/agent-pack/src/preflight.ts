import { createHash } from "node:crypto";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
} from "./contracts.js";
import type { AgentPackExitClass } from "./exitCodes.js";
import type { RepositoryContext } from "./repoContext.js";

export type PreflightMode = "fake" | "test" | "live";
export type PreflightInput = { readonly mode: PreflightMode };

export type PreflightFacts = {
  readonly host: {
    readonly os: string;
    readonly architecture: string;
    readonly osSupported: boolean;
    readonly node: VersionFact;
    readonly pnpm: VersionFact;
    readonly corepack: "ready" | "missing";
    readonly git: VersionFact & { readonly worktree: boolean };
  };
  readonly prerequisites: {
    readonly dependencies: "installed" | "missing";
    readonly disk: "ready" | "low" | "unknown";
    readonly ports: "ready" | "blocked" | "not-required";
  };
  readonly repository: {
    readonly role:
      "greenfield" | "canonical-clone" | "existing-app" | "ambiguous";
    readonly rootRoles: {
      readonly source: "canonical" | "existing-app";
      readonly template: "immutable-template";
      readonly target: "canonical" | "new-target" | "existing-app";
    };
    readonly commit: string;
    readonly gitRoot: string;
    readonly rootMatches: boolean | "unknown";
    readonly canonicalBase: string;
    readonly canonicalTag: string;
    readonly dirty: boolean | "unknown";
    readonly generatedDrift: boolean | "unknown";
    readonly collisions: readonly string[] | "unknown";
    readonly hostIntegration: "current" | "stale" | "not-installed";
  };
  readonly network: "online" | "offline" | "unknown";
  readonly auth: "not-required" | "connected" | "cancelled" | "unknown";
  readonly observationDiagnostics?: Readonly<
    Partial<
      Record<
        "network" | "auth" | "root" | "dirty" | "collisions" | "generatedDrift",
        string
      >
    >
  >;
  readonly versionsCompatible: boolean;
  readonly versions: {
    readonly pack: string;
    readonly cli: string;
    readonly template: string;
    readonly convex: string;
    readonly workflow: string;
    readonly workpool: string;
    readonly confect: string;
    readonly effect: string;
  };
  readonly workflow: {
    readonly status: "supported" | "restricted" | "unsupported";
    readonly accepted: readonly string[];
    readonly restricted: readonly string[];
    readonly unsupported: readonly string[];
    readonly publishedDrift: boolean;
    readonly rerun: "pnpm check:workflow:fast";
  };
  readonly app: {
    readonly blueprint: string;
    readonly modules: readonly string[];
    readonly providerMode: PreflightMode;
    readonly providers: readonly ProviderPosture[];
  };
  readonly indexes: {
    readonly systems: string;
    readonly generators: string;
    readonly recipes: string;
    readonly documentation: string;
  };
  readonly claimLevels: readonly [
    "fake",
    "local",
    "dev",
    "preview",
    "staging",
    "production",
  ];
};

type VersionFact = {
  readonly current: string;
  readonly required: string;
  readonly supported: boolean;
};

type ProviderPosture = {
  readonly id: string;
  readonly posture: "sample" | "local" | "test" | "live" | "missing";
};

export type PreflightProbe = {
  readonly inspect: (
    input: PreflightInput,
    repo: RepositoryContext,
  ) => Promise<
    | PreflightFacts
    | {
        readonly facts: PreflightFacts;
        readonly fingerprintBinding: string;
      }
  >;
};

const modes = new Set<PreflightMode>(["fake", "test", "live"]);
const unavailableCodes = new Set([
  "AGENT_PACK_OS_UNSUPPORTED",
  "AGENT_PACK_NODE_UNSUPPORTED",
  "AGENT_PACK_PNPM_UNSUPPORTED",
  "AGENT_PACK_GIT_UNSUPPORTED",
  "AGENT_PACK_INSTALL_MISSING",
]);
const blockedCodes = new Set([
  "AGENT_PACK_REPO_AMBIGUOUS",
  "AGENT_PACK_DIRTY_OVERLAP",
  "AGENT_PACK_VERSION_INCOMPATIBLE",
  "AGENT_PACK_DISK_LOW",
  "AGENT_PACK_PORT_BLOCKED",
  "AGENT_PACK_GENERATED_DRIFT",
  "AGENT_PACK_GENERATED_DRIFT_UNKNOWN",
  "AGENT_PACK_GIT_ROOT_MISMATCH",
  "AGENT_PACK_GIT_ROOT_UNKNOWN",
  "AGENT_PACK_DIRTY_STATE_UNKNOWN",
  "AGENT_PACK_COLLISIONS_UNKNOWN",
  "AGENT_PACK_WORKFLOW_UNSAFE",
  "AGENT_PACK_PROVIDER_MISSING",
]);

/** Concrete preflight denials that prohibit a local mutation. */
export const mutationBlockingPreflightCodes = [
  ...unavailableCodes,
  ...blockedCodes,
] as const;
export const isMutationBlockingPreflightCode = (code: string): boolean =>
  mutationBlockingPreflightCodes.includes(
    code as (typeof mutationBlockingPreflightCodes)[number],
  );

export function createPreflightCommand(probe: PreflightProbe) {
  return defineAgentPackCommand({
    id: "preflight",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodePreflightInput,
    mutationPosture: () => "read-only",
    execute: async (input, context) => {
      const inspected = await probe.inspect(input, context.repo);
      const facts = snapshotFacts(
        isPreflightObservation(inspected) ? inspected.facts : inspected,
      );
      const fingerprintBinding = isPreflightObservation(inspected)
        ? inspected.fingerprintBinding
        : "environment_binding_sha256:unavailable";
      const diagnostics = preflightDiagnostics(facts, input.mode);
      const safeToMutate = !diagnostics.some(({ code }) =>
        isMutationBlockingPreflightCode(code),
      );
      return {
        mutationPosture: "read-only",
        exitClass: preflightExitClass(diagnostics),
        summary: safeToMutate
          ? "Preflight passed. This checkout is ready for safe local work."
          : "Preflight found readiness issues.",
        diagnostics,
        data: {
          fingerprint: fingerprintPreflight(
            context.repo,
            facts,
            fingerprintBinding,
          ),
          safeToMutate,
          worksNow: worksNow(facts),
          demoOnly: demoOnly(facts),
          nextAction: diagnostics[0]?.rerun ?? "pnpm maestro -- check",
          facts,
        },
      };
    },
  });
}

export function fingerprintPreflight(
  repo: RepositoryContext,
  facts: PreflightFacts,
  fingerprintBinding = "environment_binding_sha256:unavailable",
): string {
  const content = stableJson({
    repo,
    facts: snapshotFacts(facts),
    fingerprintBinding,
  });
  return `preflight_sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function isPreflightObservation(
  value: PreflightFacts | { readonly facts: PreflightFacts },
): value is {
  readonly facts: PreflightFacts;
  readonly fingerprintBinding: string;
} {
  return isRecord(value) && "facts" in value && "fingerprintBinding" in value;
}

function decodePreflightInput(
  input: unknown,
): AgentPackArgumentResult<PreflightInput> {
  if (
    isRecord(input) &&
    Object.keys(input).length === 1 &&
    modes.has(input.mode as PreflightMode)
  ) {
    return { ok: true, args: { mode: input.mode as PreflightMode } };
  }
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "AGENT_PACK_PREFLIGHT_INVALID",
        "Preflight mode must be fake, test, or live.",
        false,
        "Choose fake, test, or live mode.",
        "pnpm maestro -- preflight --mode fake",
      ),
    ],
  };
}

function preflightDiagnostics(
  facts: PreflightFacts,
  mode: PreflightMode,
): readonly AgentPackDiagnostic[] {
  const diagnostics: AgentPackDiagnostic[] = [];
  const add = (
    condition: boolean,
    ...args: Parameters<typeof diagnostic>
  ): void => {
    if (condition) diagnostics.push(diagnostic(...args));
  };
  add(
    !facts.host.osSupported,
    "AGENT_PACK_OS_UNSUPPORTED",
    `Unsupported host OS: ${facts.host.os}.`,
    false,
    "Use a supported host OS.",
    "pnpm maestro -- preflight --json",
  );
  add(
    !facts.host.node.supported,
    "AGENT_PACK_NODE_UNSUPPORTED",
    `Node ${facts.host.node.current} does not match ${facts.host.node.required}.`,
    false,
    "Install the required Node version.",
    "pnpm maestro -- preflight --json",
  );
  add(
    !facts.host.pnpm.supported,
    "AGENT_PACK_PNPM_UNSUPPORTED",
    "The pinned pnpm toolchain is unavailable.",
    false,
    "Run node scripts/maestro-bootstrap.mjs for the pinned Corepack or npx installation command.",
    "pnpm maestro -- preflight --json",
  );
  add(
    !facts.host.git.supported || !facts.host.git.worktree,
    "AGENT_PACK_GIT_UNSUPPORTED",
    "Git worktree support is unavailable.",
    false,
    "Install a supported Git version.",
    "pnpm maestro -- preflight --json",
  );
  add(
    facts.prerequisites.dependencies === "missing",
    "AGENT_PACK_INSTALL_MISSING",
    "Repository dependencies are not installed.",
    true,
    "Install the locked dependencies.",
    "pnpm install --frozen-lockfile",
  );
  add(
    mode !== "fake" && facts.network === "offline",
    "AGENT_PACK_OFFLINE",
    "The host is offline; committed checks remain available.",
    true,
    "Continue with committed fake/local checks.",
    "pnpm maestro -- preflight --mode fake",
  );
  add(
    mode !== "fake" && facts.network === "unknown",
    "AGENT_PACK_NETWORK_UNKNOWN",
    observationMessage(
      facts,
      "network",
      "Registry reachability was attempted but could not be determined.",
    ),
    true,
    "Continue with committed fake/local checks or inspect registry reachability.",
    "pnpm maestro -- preflight --mode fake",
  );
  add(
    facts.repository.role === "ambiguous",
    "AGENT_PACK_REPO_AMBIGUOUS",
    "Source, template, and target roles are ambiguous.",
    false,
    "Resolve each repository root role before writing.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.repository.rootMatches === false,
    "AGENT_PACK_GIT_ROOT_MISMATCH",
    `Observed Git root ${facts.repository.gitRoot} does not match source root.`,
    false,
    "Run Maestro from the intended repository root.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.repository.rootMatches === "unknown",
    "AGENT_PACK_GIT_ROOT_UNKNOWN",
    observationMessage(
      facts,
      "root",
      "The Git repository root could not be observed.",
    ),
    false,
    "Restore bounded Git root inspection before mutation.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.repository.dirty === "unknown",
    "AGENT_PACK_DIRTY_STATE_UNKNOWN",
    observationMessage(
      facts,
      "dirty",
      "Worktree dirty state could not be observed.",
    ),
    false,
    "Restore bounded Git status inspection before mutation.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.repository.collisions === "unknown",
    "AGENT_PACK_COLLISIONS_UNKNOWN",
    observationMessage(
      facts,
      "collisions",
      "Dirty target-path collisions could not be attributed.",
    ),
    false,
    "Restore dirty-path attribution before mutation.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.repository.dirty === true &&
      facts.repository.collisions !== "unknown" &&
      facts.repository.collisions.length > 0,
    "AGENT_PACK_DIRTY_OVERLAP",
    "Dirty files overlap planned target paths.",
    false,
    "Resolve the listed dirty collisions.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.repository.generatedDrift === true,
    "AGENT_PACK_GENERATED_DRIFT",
    "Generated output differs from its declared provenance.",
    false,
    "Regenerate and review the generated output.",
    "pnpm check:generators",
  );
  add(
    facts.repository.generatedDrift === "unknown",
    "AGENT_PACK_GENERATED_DRIFT_UNKNOWN",
    observationMessage(
      facts,
      "generatedDrift",
      "Generated drift could not be observed.",
    ),
    false,
    "Restore generated-path Git inspection before mutation.",
    "pnpm check:generators",
  );
  add(
    !facts.versionsCompatible,
    "AGENT_PACK_VERSION_INCOMPATIBLE",
    "Pinned package versions are incompatible.",
    false,
    "Select a compatible pack and template version.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.app.modules.includes("workflows") &&
      (facts.workflow.status === "unsupported" ||
        facts.workflow.publishedDrift),
    "AGENT_PACK_WORKFLOW_UNSAFE",
    "Workflow semantics are unsupported or differ from the published ledger.",
    false,
    "Repair workflow semantics before mutation.",
    facts.workflow.rerun,
  );
  add(
    facts.repository.hostIntegration === "stale",
    "AGENT_PACK_HOST_STALE",
    "Installed host context is stale.",
    true,
    "Refresh the optional host integration.",
    "pnpm check:agent-pack",
  );
  add(
    facts.auth === "cancelled",
    "AGENT_PACK_AUTH_CANCELLED",
    "Optional account connection was cancelled.",
    true,
    "Continue with fake mode or reconnect outside the command.",
    "pnpm maestro -- preflight --mode fake",
  );
  add(
    facts.auth === "unknown",
    "AGENT_PACK_AUTH_UNKNOWN",
    observationMessage(
      facts,
      "auth",
      "Authentication posture was attempted but remains ambiguous.",
    ),
    true,
    "Use fake mode or run the provider-specific doctor before connected work.",
    "pnpm maestro -- preflight --mode fake",
  );
  add(
    facts.prerequisites.disk === "low",
    "AGENT_PACK_DISK_LOW",
    "Available disk space is below the local-work threshold.",
    false,
    "Free disk space before mutation.",
    "pnpm maestro -- preflight --details",
  );
  add(
    facts.prerequisites.ports === "blocked",
    "AGENT_PACK_PORT_BLOCKED",
    "A required local port is unavailable.",
    false,
    "Release or reconfigure the required local port.",
    "pnpm maestro -- preflight --details",
  );
  for (const provider of facts.app.providers) {
    add(
      facts.app.providerMode !== "fake" && provider.posture === "missing",
      "AGENT_PACK_PROVIDER_MISSING",
      `Provider ${provider.id} is not configured for ${facts.app.providerMode}.`,
      true,
      `Configure provider ${provider.id} without exposing secret values.`,
      `pnpm maestro -- preflight --mode ${facts.app.providerMode}`,
    );
  }
  return diagnostics;
}

function observationMessage(
  facts: PreflightFacts,
  key: keyof NonNullable<PreflightFacts["observationDiagnostics"]>,
  fallback: string,
): string {
  return facts.observationDiagnostics?.[key] ?? fallback;
}

function preflightExitClass(
  diagnostics: readonly AgentPackDiagnostic[],
): AgentPackExitClass {
  if (diagnostics.some(({ code }) => unavailableCodes.has(code)))
    return "unavailableDependency";
  if (diagnostics.some(({ code }) => blockedCodes.has(code)))
    return "blockedMutation";
  return diagnostics.length === 0 ? "success" : "findings";
}

function diagnostic(
  code: string,
  message: string,
  safeToContinue: boolean,
  nextAction: string,
  rerun: string,
): AgentPackDiagnostic {
  return {
    code,
    severity:
      !safeToContinue || unavailableCodes.has(code) || blockedCodes.has(code)
        ? "error"
        : "warning",
    message,
    safeToContinue,
    nextAction,
    rerun,
  };
}

function worksNow(facts: PreflightFacts): string {
  if (facts.app.providerMode === "fake")
    return "What works now: the app uses deterministic in-memory sample data.";
  return `What works now: the app uses a connected ${facts.app.providerMode === "test" ? "test account" : "live account"}.`;
}

function demoOnly(facts: PreflightFacts): string {
  return facts.app.providers.some(({ posture }) => posture === "sample")
    ? "What is demo-only: provider-backed actions still use sample data."
    : "What is demo-only: no enabled module is marked demo-only.";
}

function snapshotFacts(facts: PreflightFacts): PreflightFacts {
  return JSON.parse(JSON.stringify(facts)) as PreflightFacts;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
