import { AGENT_PACK_COMMAND_VERSION } from "./contracts.js";
import type {
  DiagnosticPosture,
  EvidenceClass,
  GateObservationStatus,
} from "./diagnostics.js";

export const VERIFICATION_RECEIPT_VERSION = 1 as const;

export type VerificationSubject = {
  readonly commit: string;
  readonly dirty: boolean;
};

export type RepositoryFingerprint = `repository_sha256:${string}`;
export type EnvironmentFingerprint = `environment_sha256:${string}`;
export type ProvidersFingerprint = `providers_sha256:${string}`;

export type VerificationScope =
  | {
      readonly kind: "full";
      readonly changedPaths: readonly [];
      readonly partial: false;
    }
  | {
      readonly kind: "focused";
      readonly changedPaths: readonly string[];
      readonly partial: true;
    };

export type VerificationGateObservation = {
  readonly gateId: string;
  readonly posture: DiagnosticPosture;
  readonly evidenceClass: EvidenceClass;
  readonly status: GateObservationStatus;
  readonly argv: readonly string[];
  readonly semanticRuleIds: readonly string[];
};

export type VerificationReceiptInput = {
  readonly createdAt: string;
  readonly command: {
    readonly id: string;
    readonly version: typeof AGENT_PACK_COMMAND_VERSION;
  };
  readonly subject: VerificationSubject;
  readonly repositoryFingerprint: RepositoryFingerprint;
  readonly environmentFingerprint: EnvironmentFingerprint;
  readonly providerPostureFingerprint: ProvidersFingerprint;
  readonly scope: VerificationScope;
  readonly gates: readonly VerificationGateObservation[];
};

export type VerificationReceipt = {
  readonly schemaVersion: typeof VERIFICATION_RECEIPT_VERSION;
  readonly createdAt: string;
  readonly command: VerificationReceiptInput["command"];
  readonly subject: VerificationSubject;
  readonly fingerprints: {
    readonly repository: RepositoryFingerprint;
    readonly environment: EnvironmentFingerprint;
    readonly providerPosture: ProvidersFingerprint;
  };
  readonly scope: VerificationScope;
  readonly gates: readonly VerificationGateObservation[];
};

export type ReceiptStalenessReason =
  | "commit-changed"
  | "dirty-state-changed"
  | "repository-fingerprint-changed"
  | "environment-changed"
  | "provider-posture-changed"
  | "partial-scope";

export type ReceiptStaleness = {
  readonly stale: boolean;
  readonly reasons: readonly ReceiptStalenessReason[];
};

export type VerificationReceiptSummary = {
  readonly status: "pass" | "pass-with-advisories" | "fail";
  readonly requiredFailures: readonly string[];
  readonly advisoryFailures: readonly string[];
  readonly unavailable: readonly string[];
};

export type UpgradeImpactReceiptResult<Impact> =
  | {
      readonly ok: true;
      readonly receipt: VerificationReceipt & {
        readonly upgradeImpact: Impact;
      };
    }
  | {
      readonly ok: false;
      readonly code: "VERIFICATION_RECEIPT_UPGRADE_IMPACT_INVALID";
    };

export function attachReviewedUpgradeImpact<Impact>(
  receipt: VerificationReceipt,
  candidate: unknown,
  project: (
    candidate: unknown,
  ) => { readonly ok: true; readonly value: Impact } | { readonly ok: false },
): UpgradeImpactReceiptResult<Impact> {
  try {
    const projected = project(candidate);
    if (!projected.ok) {
      return {
        ok: false,
        code: "VERIFICATION_RECEIPT_UPGRADE_IMPACT_INVALID",
      };
    }
    return {
      ok: true,
      receipt: { ...receipt, upgradeImpact: projected.value },
    };
  } catch {
    return {
      ok: false,
      code: "VERIFICATION_RECEIPT_UPGRADE_IMPACT_INVALID",
    };
  }
}

export function createVerificationReceipt(
  input: VerificationReceiptInput,
): VerificationReceipt {
  return {
    schemaVersion: VERIFICATION_RECEIPT_VERSION,
    createdAt: input.createdAt,
    command: { ...input.command },
    subject: { ...input.subject },
    fingerprints: {
      repository: input.repositoryFingerprint,
      environment: input.environmentFingerprint,
      providerPosture: input.providerPostureFingerprint,
    },
    scope:
      input.scope.kind === "full"
        ? { kind: "full", changedPaths: [], partial: false }
        : {
            kind: "focused",
            changedPaths: [...input.scope.changedPaths],
            partial: true,
          },
    gates: input.gates.map((gate) => ({
      ...gate,
      argv: [...gate.argv],
      semanticRuleIds: [...gate.semanticRuleIds],
    })),
  };
}

export function evaluateReceiptStaleness(
  receipt: VerificationReceipt,
  current: {
    readonly subject: VerificationSubject;
    readonly repositoryFingerprint: RepositoryFingerprint;
    readonly environmentFingerprint: EnvironmentFingerprint;
    readonly providerPostureFingerprint: ProvidersFingerprint;
  },
): ReceiptStaleness {
  const reasons: ReceiptStalenessReason[] = [];
  if (receipt.subject.commit !== current.subject.commit)
    reasons.push("commit-changed");
  if (receipt.subject.dirty !== current.subject.dirty)
    reasons.push("dirty-state-changed");
  if (receipt.fingerprints.repository !== current.repositoryFingerprint) {
    reasons.push("repository-fingerprint-changed");
  }
  if (receipt.fingerprints.environment !== current.environmentFingerprint) {
    reasons.push("environment-changed");
  }
  if (
    receipt.fingerprints.providerPosture !== current.providerPostureFingerprint
  ) {
    reasons.push("provider-posture-changed");
  }
  if (receipt.scope.partial) reasons.push("partial-scope");
  return { stale: reasons.length > 0, reasons };
}

export function summarizeVerificationReceipt(
  receipt: VerificationReceipt,
): VerificationReceiptSummary {
  const requiredFailures: string[] = [];
  const advisoryFailures: string[] = [];
  const unavailable: string[] = [];

  for (const gate of receipt.gates) {
    if (gate.status === "unavailable") unavailable.push(gate.gateId);
    if (gate.status === "pass") continue;
    if (gate.posture === "required") requiredFailures.push(gate.gateId);
    else advisoryFailures.push(gate.gateId);
  }

  const status =
    requiredFailures.length > 0
      ? "fail"
      : advisoryFailures.length > 0
        ? "pass-with-advisories"
        : "pass";
  return { status, requiredFailures, advisoryFailures, unavailable };
}
