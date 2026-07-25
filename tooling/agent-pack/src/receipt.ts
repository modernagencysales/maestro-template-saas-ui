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

export type VerificationScope = {
  readonly kind: "full" | "focused";
  readonly changedPaths: readonly string[];
  readonly partial: boolean;
};

export type VerificationGateObservation = {
  readonly gateId: string;
  readonly posture: DiagnosticPosture;
  readonly evidenceClass: EvidenceClass;
  readonly status: GateObservationStatus;
  readonly semanticRuleIds: readonly string[];
};

export type VerificationReceiptInput = {
  readonly createdAt: string;
  readonly command: {
    readonly id: string;
    readonly version: typeof AGENT_PACK_COMMAND_VERSION;
  };
  readonly subject: VerificationSubject;
  readonly environmentFingerprint: string;
  readonly providerPostureFingerprint: string;
  readonly scope: VerificationScope;
  readonly gates: readonly VerificationGateObservation[];
};

export type VerificationReceipt = {
  readonly schemaVersion: typeof VERIFICATION_RECEIPT_VERSION;
  readonly createdAt: string;
  readonly command: VerificationReceiptInput["command"];
  readonly subject: VerificationSubject;
  readonly fingerprints: {
    readonly environment: string;
    readonly providerPosture: string;
  };
  readonly scope: VerificationScope;
  readonly gates: readonly VerificationGateObservation[];
};

export type ReceiptStalenessReason =
  | "commit-changed"
  | "dirty-state-changed"
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

export function createVerificationReceipt(
  input: VerificationReceiptInput,
): VerificationReceipt {
  return {
    schemaVersion: VERIFICATION_RECEIPT_VERSION,
    createdAt: input.createdAt,
    command: { ...input.command },
    subject: { ...input.subject },
    fingerprints: {
      environment: input.environmentFingerprint,
      providerPosture: input.providerPostureFingerprint,
    },
    scope: { ...input.scope, changedPaths: [...input.scope.changedPaths] },
    gates: input.gates.map((gate) => ({
      ...gate,
      semanticRuleIds: [...gate.semanticRuleIds],
    })),
  };
}

export function evaluateReceiptStaleness(
  receipt: VerificationReceipt,
  current: {
    readonly subject: VerificationSubject;
    readonly environmentFingerprint: string;
    readonly providerPostureFingerprint: string;
  },
): ReceiptStaleness {
  const reasons: ReceiptStalenessReason[] = [];
  if (receipt.subject.commit !== current.subject.commit)
    reasons.push("commit-changed");
  if (receipt.subject.dirty !== current.subject.dirty)
    reasons.push("dirty-state-changed");
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
