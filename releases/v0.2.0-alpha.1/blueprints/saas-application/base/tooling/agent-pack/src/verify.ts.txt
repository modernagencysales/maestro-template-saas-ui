import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
} from "./contracts.js";
import {
  defineDiagnosticRegistryProjection,
  projectGateDiagnostic,
  type DiagnosticDescriptor,
  type GateObservationStatus,
} from "./diagnostics.js";
import {
  createVerificationReceipt,
  summarizeVerificationReceipt,
  type EnvironmentFingerprint,
  type ProvidersFingerprint,
  type RepositoryFingerprint,
  type VerificationSubject,
} from "./receipt.js";
import type { RepositoryContext } from "./repoContext.js";

export type VerifyInput = {
  readonly scope: "focused" | "full";
  readonly changed: readonly string[];
};

export type VerificationRunObservation = {
  readonly gateId: string;
  readonly status: GateObservationStatus;
  readonly message: string;
  readonly semanticRuleIds?: readonly string[];
  readonly diagnostic?: AgentPackDiagnostic;
};

export type VerificationRunRequest = {
  readonly repo: RepositoryContext;
  readonly scope: VerifyInput["scope"];
  readonly changed: readonly string[];
  readonly descriptors: readonly DiagnosticDescriptor[];
};

export type VerificationRuntimeFacts = {
  readonly createdAt: string;
  readonly subject: VerificationSubject;
  readonly repositoryFingerprint: RepositoryFingerprint;
  readonly environmentFingerprint: EnvironmentFingerprint;
  readonly providerPostureFingerprint: ProvidersFingerprint;
};

export type VerificationRunner = {
  readonly inspect: (
    repo: RepositoryContext,
  ) => Promise<VerificationRuntimeFacts>;
  readonly run: (
    request: VerificationRunRequest,
  ) => Promise<readonly VerificationRunObservation[]>;
};

export function createVerifyCommand(input: {
  readonly descriptors: readonly DiagnosticDescriptor[];
  readonly runner: VerificationRunner;
}) {
  const registry = defineDiagnosticRegistryProjection(input.descriptors);
  return defineAgentPackCommand({
    id: "verify",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeVerifyInput,
    mutationPosture: () => "read-only",
    execute: async (args, context) => {
      const descriptors = selectDescriptors(registry, args);
      const facts = await input.runner.inspect(context.repo);
      const selectionDiagnostics =
        descriptors.length === 0
          ? [
              {
                code: "AGENT_PACK_VERIFY_GATE_SELECTION_EMPTY",
                severity: "error" as const,
                message:
                  "Verification resolved no canonical gates for the requested scope.",
                safeToContinue: false,
                nextAction:
                  "Restore the canonical diagnostic registry or choose changed paths owned by a registered gate.",
                rerun: "pnpm maestro -- verify --scope focused",
              },
            ]
          : [];
      const observed =
        descriptors.length === 0
          ? []
          : await input.runner.run({
              repo: context.repo,
              scope: args.scope,
              changed: args.changed,
              descriptors,
            });
      const after = await input.runner.inspect(context.repo);
      const observations = completeObservations(descriptors, observed);
      const metadataDiagnostics = verificationContextDiagnostics(facts, after);
      const runnerDiagnostics = observed.flatMap((observation) =>
        observation.diagnostic === undefined ? [] : [observation.diagnostic],
      );
      const receipt = createVerificationReceipt({
        createdAt: facts.createdAt,
        command: { id: "verify", version: AGENT_PACK_COMMAND_VERSION },
        subject: facts.subject,
        repositoryFingerprint: facts.repositoryFingerprint,
        environmentFingerprint: facts.environmentFingerprint,
        providerPostureFingerprint: facts.providerPostureFingerprint,
        scope:
          args.scope === "full"
            ? { kind: "full", changedPaths: [], partial: false }
            : {
                kind: "focused",
                changedPaths: args.changed,
                partial: true,
              },
        gates: observations.map(({ descriptor, observation }) => ({
          gateId: descriptor.gateId,
          posture: descriptor.posture,
          evidenceClass: descriptor.evidenceClass,
          status: observation.status,
          semanticRuleIds: [...(observation.semanticRuleIds ?? [])],
        })),
      });
      const diagnostics = [
        ...selectionDiagnostics,
        ...metadataDiagnostics,
        ...runnerDiagnostics,
        ...observations.flatMap(({ descriptor, observation }) =>
          observation.status === "pass"
            ? []
            : [
                projectGateDiagnostic(descriptor, {
                  status: observation.status,
                  message: observation.message,
                  ...(observation.semanticRuleIds
                    ? { semanticRuleIds: observation.semanticRuleIds }
                    : {}),
                }),
              ],
        ),
      ];
      const summarized = summarizeVerificationReceipt(receipt);
      const summary =
        descriptors.length === 0
          ? {
              status: "fail" as const,
              requiredFailures: ["maestro/gate-selection"],
              advisoryFailures: [],
              unavailable: ["maestro/gate-selection"],
            }
          : summarized;
      const requiredBlocking =
        selectionDiagnostics.length > 0 ||
        summary.requiredFailures.length > 0 ||
        metadataDiagnostics.length > 0 ||
        runnerDiagnostics.some(({ severity }) => severity === "error");
      return {
        mutationPosture: "read-only" as const,
        exitClass:
          diagnostics.length === 0
            ? ("success" as const)
            : ("findings" as const),
        summary:
          diagnostics.length === 0
            ? "Verification passed."
            : requiredBlocking
              ? "Verification found required failures."
              : "Required verification passed with advisory findings.",
        diagnostics,
        data: { receipt, summary, requiredBlocking },
      };
    },
  });
}

export function decodeVerifyInput(
  input: unknown,
): AgentPackArgumentResult<VerifyInput> {
  if (
    typeof input !== "object" ||
    input === null ||
    !("scope" in input) ||
    !Object.keys(input).every((key) => key === "scope" || key === "changed")
  ) {
    return invalidVerifyInput("Verification input must include a scope.");
  }
  const scope = input.scope;
  if ("changed" in input && !Array.isArray(input.changed)) {
    return invalidVerifyInput("Changed paths must be an array.");
  }
  const changed =
    "changed" in input && Array.isArray(input.changed) ? input.changed : [];
  if (
    (scope !== "focused" && scope !== "full") ||
    (scope === "full" && changed.length > 0) ||
    !changed.every(
      (path) =>
        typeof path === "string" &&
        path.length > 0 &&
        path.trim() === path &&
        !path.startsWith("/") &&
        !path.startsWith("\\") &&
        !/^[a-zA-Z]:[\\/]/.test(path) &&
        !path.split(/[\\/]/).includes(".."),
    )
  ) {
    return invalidVerifyInput(
      "Scope must be focused or full and changed paths must be bounded.",
    );
  }
  return { ok: true, args: { scope, changed } };
}

function verificationContextDiagnostics(
  before: VerificationRuntimeFacts,
  after: VerificationRuntimeFacts,
): readonly AgentPackDiagnostic[] {
  const fingerprints = [
    {
      label: "repository",
      before: before.repositoryFingerprint,
      after: after.repositoryFingerprint,
      unavailable: "repository_sha256:unavailable",
    },
    {
      label: "environment",
      before: before.environmentFingerprint,
      after: after.environmentFingerprint,
      unavailable: "environment_sha256:unavailable",
    },
    {
      label: "provider posture",
      before: before.providerPostureFingerprint,
      after: after.providerPostureFingerprint,
      unavailable: "providers_sha256:unavailable",
    },
  ] as const;
  const unavailable = fingerprints
    .filter(
      (fingerprint) =>
        fingerprint.before === fingerprint.unavailable ||
        fingerprint.after === fingerprint.unavailable,
    )
    .map(({ label }) => label);
  if (unavailable.length > 0) {
    return [
      {
        code: "AGENT_PACK_VERIFICATION_CONTEXT_UNAVAILABLE",
        severity: "error",
        message: `Verification context metadata was unavailable before or after gates: ${unavailable.join(", ")}.`,
        safeToContinue: false,
        nextAction:
          "Restore repository, environment, and provider metadata inspection before trusting verification.",
        rerun: "pnpm maestro -- verify --scope focused",
      },
    ];
  }
  const changed = fingerprints
    .filter((fingerprint) => fingerprint.before !== fingerprint.after)
    .map(({ label }) => label);
  if (changed.length > 0) {
    return [
      {
        code: "AGENT_PACK_VERIFICATION_CONTEXT_CHANGED_DURING_VERIFY",
        severity: "error",
        message: `Verification context changed while gates were running: ${changed.join(", ")}.`,
        safeToContinue: false,
        nextAction:
          "Stabilize repository, environment, and provider context, then rerun verification.",
        rerun: "pnpm maestro -- verify --scope focused",
      },
    ];
  }
  return [];
}

function invalidVerifyInput(
  message: string,
): AgentPackArgumentResult<VerifyInput> {
  const diagnostic: AgentPackDiagnostic = {
    code: "AGENT_PACK_VERIFY_INVALID",
    severity: "error",
    message,
    safeToContinue: false,
    nextAction:
      "Choose focused or full verification with repository-relative paths.",
    rerun: "pnpm maestro -- verify --scope focused",
  };
  return { ok: false, diagnostics: [diagnostic] };
}

function selectDescriptors(
  descriptors: readonly DiagnosticDescriptor[],
  input: VerifyInput,
): readonly DiagnosticDescriptor[] {
  if (input.scope === "full") return descriptors;
  if (input.changed.length === 0) {
    return descriptors.filter(({ defaultFocused }) => defaultFocused === true);
  }
  return descriptors.filter((descriptor) =>
    (descriptor.focusedPathPrefixes ?? []).some((prefix) =>
      input.changed.some((path) => path.startsWith(prefix)),
    ),
  );
}

function completeObservations(
  descriptors: readonly DiagnosticDescriptor[],
  observed: readonly VerificationRunObservation[],
): readonly {
  readonly descriptor: DiagnosticDescriptor;
  readonly observation: VerificationRunObservation;
}[] {
  const byGate = new Map(observed.map((entry) => [entry.gateId, entry]));
  return descriptors.map((descriptor) => ({
    descriptor,
    observation: byGate.get(descriptor.gateId) ?? {
      gateId: descriptor.gateId,
      status: "unavailable",
      message: `Verification evidence for ${descriptor.gateId} is unavailable.`,
    },
  }));
}
