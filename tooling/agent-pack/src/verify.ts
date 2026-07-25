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
  type VerificationSubject,
} from "./receipt.js";

export type VerifyInput = {
  readonly scope: "focused" | "full";
  readonly changed: readonly string[];
};

export type VerificationRunObservation = {
  readonly gateId: string;
  readonly status: GateObservationStatus;
  readonly message: string;
  readonly semanticRuleIds?: readonly string[];
};

export type VerificationRunRequest = {
  readonly scope: VerifyInput["scope"];
  readonly changed: readonly string[];
  readonly descriptors: readonly DiagnosticDescriptor[];
};

export type VerificationRuntimeFacts = {
  readonly createdAt: string;
  readonly subject: VerificationSubject;
  readonly environmentFingerprint: string;
  readonly providerPostureFingerprint: string;
};

export type VerificationRunner = {
  readonly inspect: () => Promise<VerificationRuntimeFacts>;
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
    execute: async (args) => {
      const descriptors = selectDescriptors(registry, args);
      const [facts, observed] = await Promise.all([
        input.runner.inspect(),
        input.runner.run({
          scope: args.scope,
          changed: args.changed,
          descriptors,
        }),
      ]);
      const observations = completeObservations(descriptors, observed);
      const receipt = createVerificationReceipt({
        createdAt: facts.createdAt,
        command: { id: "verify", version: AGENT_PACK_COMMAND_VERSION },
        subject: facts.subject,
        environmentFingerprint: facts.environmentFingerprint,
        providerPostureFingerprint: facts.providerPostureFingerprint,
        scope: {
          kind: args.scope,
          changedPaths: args.changed,
          partial: args.scope === "focused",
        },
        gates: observations.map(({ descriptor, observation }) => ({
          gateId: descriptor.gateId,
          posture: descriptor.posture,
          evidenceClass: descriptor.evidenceClass,
          status: observation.status,
          semanticRuleIds: [...(observation.semanticRuleIds ?? [])],
        })),
      });
      const diagnostics = observations.flatMap(({ descriptor, observation }) =>
        observation.status === "pass"
          ? []
          : [
              projectGateDiagnostic(descriptor, {
                status: observation.status,
                message: observation.message,
                semanticRuleIds: observation.semanticRuleIds,
              }),
            ],
      );
      const summary = summarizeVerificationReceipt(receipt);
      const requiredBlocking = summary.requiredFailures.length > 0;
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

function decodeVerifyInput(
  input: unknown,
): AgentPackArgumentResult<VerifyInput> {
  if (typeof input !== "object" || input === null || !("scope" in input)) {
    return invalidVerifyInput("Verification input must include a scope.");
  }
  const scope = input.scope;
  const changed =
    "changed" in input && Array.isArray(input.changed) ? input.changed : [];
  if (
    (scope !== "focused" && scope !== "full") ||
    !changed.every(
      (path) =>
        typeof path === "string" &&
        path.length > 0 &&
        !path.startsWith("/") &&
        !path.split(/[\\/]/).includes(".."),
    )
  ) {
    return invalidVerifyInput(
      "Scope must be focused or full and changed paths must be bounded.",
    );
  }
  return { ok: true, args: { scope, changed } };
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
  if (input.scope === "full" || input.changed.length === 0) return descriptors;
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
