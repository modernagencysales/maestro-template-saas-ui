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
import type { VerificationReceiptWriter } from "./receiptExport.js";

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
  readonly writer?: VerificationReceiptWriter;
}) {
  const registry = defineDiagnosticRegistryProjection(input.descriptors);
  return defineAgentPackCommand({
    id: "verify",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeVerifyInput,
    mutationPosture: () => (input.writer === undefined ? "read-only" : "write"),
    execute: async (args, context) => {
      const descriptors = selectDescriptors(registry, args);
      const facts = await input.runner.inspect(context.repo);
      const selectionDiagnostics = selectionDiagnostic(descriptors);
      const observed = await observeDescriptors(
        input.runner,
        context.repo,
        args,
        descriptors,
      );
      const after = await input.runner.inspect(context.repo);
      const observations = completeObservations(descriptors, observed);
      const metadataDiagnostics = verificationContextDiagnostics(facts, after);
      const receipt = createVerifyReceipt(facts, args, observations);
      const persistenceDiagnostics = await persistReceipt(
        input.writer,
        context.repo,
        receipt,
        args.scope,
      );
      return verifyResult({
        writer: input.writer,
        descriptors,
        receipt,
        observations,
        selectionDiagnostics,
        metadataDiagnostics,
        runnerDiagnostics: runnerDiagnostics(observed),
        persistenceDiagnostics,
      });
    },
  });
}

export function decodeVerifyInput(
  input: unknown,
): AgentPackArgumentResult<VerifyInput> {
  if (!isVerifyInputRecord(input)) {
    return invalidVerifyInput("Verification input must include a scope.");
  }
  const parsed = parseVerifyInput(input);
  if (parsed === null) {
    return invalidVerifyInput("Changed paths must be an array.");
  }
  if (!validVerifyInput(parsed)) {
    return invalidVerifyInput(
      "Scope must be focused or full and changed paths must be bounded.",
    );
  }
  return { ok: true, args: parsed };
}

const selectionDiagnostic = (
  descriptors: readonly DiagnosticDescriptor[],
): readonly AgentPackDiagnostic[] =>
  descriptors.length === 0
    ? [
        {
          code: "AGENT_PACK_VERIFY_GATE_SELECTION_EMPTY",
          severity: "error",
          message:
            "Verification resolved no canonical gates for the requested scope.",
          safeToContinue: false,
          nextAction:
            "Restore the canonical diagnostic registry or choose changed paths owned by a registered gate.",
          rerun: "pnpm maestro -- verify --scope focused",
        },
      ]
    : [];

const observeDescriptors = async (
  runner: VerificationRunner,
  repo: RepositoryContext,
  args: VerifyInput,
  descriptors: readonly DiagnosticDescriptor[],
): Promise<readonly VerificationRunObservation[]> => {
  if (descriptors.length === 0) return [];
  return runner.run({
    repo,
    scope: args.scope,
    changed: args.changed,
    descriptors,
  });
};

const runnerDiagnostics = (
  observations: readonly VerificationRunObservation[],
): readonly AgentPackDiagnostic[] =>
  observations.flatMap((observation) =>
    observation.diagnostic === undefined ? [] : [observation.diagnostic],
  );

const receiptScope = (input: VerifyInput) =>
  input.scope === "full"
    ? {
        kind: "full" as const,
        changedPaths: [] as const,
        partial: false as const,
      }
    : {
        kind: "focused" as const,
        changedPaths: input.changed,
        partial: true as const,
      };

const createVerifyReceipt = (
  facts: VerificationRuntimeFacts,
  args: VerifyInput,
  observations: readonly {
    readonly descriptor: DiagnosticDescriptor;
    readonly observation: VerificationRunObservation;
  }[],
) =>
  createVerificationReceipt({
    createdAt: facts.createdAt,
    command: { id: "verify", version: AGENT_PACK_COMMAND_VERSION },
    subject: facts.subject,
    repositoryFingerprint: facts.repositoryFingerprint,
    environmentFingerprint: facts.environmentFingerprint,
    providerPostureFingerprint: facts.providerPostureFingerprint,
    scope: receiptScope(args),
    gates: observations.map(({ descriptor, observation }) => ({
      gateId: descriptor.gateId,
      posture: descriptor.posture,
      evidenceClass: descriptor.evidenceClass,
      status: observation.status,
      argv: [...descriptor.argv],
      semanticRuleIds: [...(observation.semanticRuleIds ?? [])],
    })),
  });

const persistReceipt = async (
  writer: VerificationReceiptWriter | undefined,
  repo: RepositoryContext,
  receipt: ReturnType<typeof createVerificationReceipt>,
  scope: VerifyInput["scope"],
): Promise<readonly AgentPackDiagnostic[]> => {
  if (writer === undefined) return [];
  try {
    await writer.persist(repo, receipt);
    return [];
  } catch {
    return [
      {
        code: "AGENT_PACK_VERIFICATION_RECEIPT_PERSIST_FAILED",
        severity: "error",
        message:
          "The complete verification receipt could not be persisted safely.",
        safeToContinue: false,
        nextAction:
          "Restore the bounded .maestro receipt directory and rerun the owned verification command.",
        rerun: `pnpm maestro -- verify --scope ${scope}`,
      },
    ];
  }
};

const gateDiagnostics = (
  observations: readonly {
    readonly descriptor: DiagnosticDescriptor;
    readonly observation: VerificationRunObservation;
  }[],
): readonly AgentPackDiagnostic[] =>
  observations.flatMap(({ descriptor, observation }) =>
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
  );

const emptySelectionSummary = {
  status: "fail" as const,
  requiredFailures: ["maestro/gate-selection"],
  advisoryFailures: [],
  unavailable: ["maestro/gate-selection"],
};

const verificationSummary = (
  descriptors: readonly DiagnosticDescriptor[],
  receipt: ReturnType<typeof createVerificationReceipt>,
) =>
  descriptors.length === 0
    ? emptySelectionSummary
    : summarizeVerificationReceipt(receipt);

const resultMessage = (input: {
  readonly diagnostics: readonly AgentPackDiagnostic[];
  readonly persistenceDiagnostics: readonly AgentPackDiagnostic[];
  readonly requiredBlocking: boolean;
}): string => {
  if (input.persistenceDiagnostics.length > 0)
    return "Verification evidence could not be persisted.";
  if (input.diagnostics.length === 0) return "Verification passed.";
  return input.requiredBlocking
    ? "Verification found required failures."
    : "Required verification passed with advisory findings.";
};

const isRequiredBlocking = (input: {
  readonly selectionDiagnostics: readonly AgentPackDiagnostic[];
  readonly metadataDiagnostics: readonly AgentPackDiagnostic[];
  readonly runnerDiagnostics: readonly AgentPackDiagnostic[];
  readonly persistenceDiagnostics: readonly AgentPackDiagnostic[];
  readonly summary: ReturnType<typeof summarizeVerificationReceipt>;
}): boolean =>
  input.selectionDiagnostics.length > 0 ||
  input.summary.requiredFailures.length > 0 ||
  input.metadataDiagnostics.length > 0 ||
  input.persistenceDiagnostics.length > 0 ||
  input.runnerDiagnostics.some(({ severity }) => severity === "error");

const verifyResult = (input: {
  readonly writer: VerificationReceiptWriter | undefined;
  readonly descriptors: readonly DiagnosticDescriptor[];
  readonly receipt: ReturnType<typeof createVerificationReceipt>;
  readonly observations: readonly {
    readonly descriptor: DiagnosticDescriptor;
    readonly observation: VerificationRunObservation;
  }[];
  readonly selectionDiagnostics: readonly AgentPackDiagnostic[];
  readonly metadataDiagnostics: readonly AgentPackDiagnostic[];
  readonly runnerDiagnostics: readonly AgentPackDiagnostic[];
  readonly persistenceDiagnostics: readonly AgentPackDiagnostic[];
}) => {
  const diagnostics = [
    ...input.selectionDiagnostics,
    ...input.metadataDiagnostics,
    ...input.runnerDiagnostics,
    ...input.persistenceDiagnostics,
    ...gateDiagnostics(input.observations),
  ];
  const summary = verificationSummary(input.descriptors, input.receipt);
  const requiredBlocking = isRequiredBlocking({ ...input, summary });
  return {
    mutationPosture:
      input.writer === undefined ? ("read-only" as const) : ("write" as const),
    exitClass:
      diagnostics.length === 0 ? ("success" as const) : ("findings" as const),
    summary: resultMessage({
      diagnostics,
      persistenceDiagnostics: input.persistenceDiagnostics,
      requiredBlocking,
    }),
    diagnostics,
    data: {
      receipt: input.receipt,
      summary,
      requiredBlocking,
      receiptPersisted:
        input.writer === undefined
          ? null
          : input.persistenceDiagnostics.length === 0,
    },
  };
};

const isVerifyInputRecord = (
  input: unknown,
): input is { readonly scope: unknown; readonly changed?: unknown } =>
  typeof input === "object" &&
  input !== null &&
  "scope" in input &&
  Object.keys(input).every((key) => key === "scope" || key === "changed");

const parseVerifyInput = (input: {
  readonly scope: unknown;
  readonly changed?: unknown;
}): VerifyInput | null => {
  if (input.changed !== undefined && !Array.isArray(input.changed)) return null;
  return {
    scope: input.scope as VerifyInput["scope"],
    changed: (input.changed ?? []) as readonly string[],
  };
};

const validChangedPath = (path: unknown): boolean =>
  typeof path === "string" &&
  path.length > 0 &&
  path.trim() === path &&
  !path.startsWith("/") &&
  !path.startsWith("\\") &&
  !/^[a-zA-Z]:[\\/]/.test(path) &&
  !path.split(/[\\/]/).includes("..");

const validVerifyInput = (input: VerifyInput): boolean =>
  (input.scope === "focused" || input.scope === "full") &&
  !(input.scope === "full" && input.changed.length > 0) &&
  input.changed.every(validChangedPath);

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
