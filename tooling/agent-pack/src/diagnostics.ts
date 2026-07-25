import type { AgentPackDiagnostic } from "./contracts.js";

export type EvidenceClass =
  "static" | "behavioral" | "runtime" | "live-promotion" | "advisory";

export type DiagnosticPosture = "required" | "advisory";
export type GateObservationStatus = "pass" | "fail" | "skipped" | "unavailable";

export type DiagnosticDescriptor = {
  readonly gateId: string;
  readonly posture: DiagnosticPosture;
  readonly evidenceClass: EvidenceClass;
  readonly canonicalDoc: string;
  readonly repairHint: string;
  readonly argv: readonly [string, ...string[]];
  readonly rerun: readonly [string, ...string[]];
  readonly focusedPathPrefixes?: readonly string[];
};

export type GateDiagnosticObservation = {
  readonly status: Exclude<GateObservationStatus, "pass">;
  readonly message: string;
  readonly semanticRuleIds?: readonly string[];
};

export type ProjectedGateDiagnostic = AgentPackDiagnostic & {
  readonly gateId: string;
  readonly posture: DiagnosticPosture;
  readonly evidenceClass: EvidenceClass;
  readonly canonicalDoc: string;
  readonly repairHint: string;
  readonly rerunArgv: readonly string[];
  readonly semanticRuleIds: readonly string[];
};

export type DescriptorValidation =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

const UNSAFE_REPAIR =
  /(?:\b(?:edit|change|modify|disable|remove|skip|bypass|weaken)\b.{0,48}\b(?:gate|check|test)\b)|(?:\b(?:gate|check|test)\b.{0,48}\b(?:disable|skip|bypass|weaken)\b)/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._/-]*$/;
const SAFE_DOC =
  /^(?:docs|agent-patterns)\/[a-zA-Z0-9._/-]+\.md(?:#[a-z0-9-]+)?$/;
const SAFE_SCRIPT = /^[a-z0-9][a-z0-9:_-]*$/;
const UNSAFE_ARG = /[\s;&|`$<>*?{}\[\]\\\n\r]/;

export function validateDiagnosticDescriptor(
  descriptor: DiagnosticDescriptor,
): DescriptorValidation {
  if (!SAFE_ID.test(descriptor.gateId)) {
    return {
      ok: false,
      reason: "gateId must be a stable, path-safe identifier",
    };
  }
  if (
    !SAFE_DOC.test(descriptor.canonicalDoc) ||
    descriptor.canonicalDoc.includes("..")
  ) {
    return {
      ok: false,
      reason: "canonicalDoc must be a repository documentation path",
    };
  }
  if (UNSAFE_REPAIR.test(descriptor.repairHint)) {
    return {
      ok: false,
      reason:
        "repairHint must repair the invariant, never edit, disable, skip, or weaken a gate",
    };
  }
  const commandError =
    validateBoundedArgv(descriptor.argv) ??
    validateBoundedArgv(descriptor.rerun);
  if (commandError !== undefined) return { ok: false, reason: commandError };

  for (const prefix of descriptor.focusedPathPrefixes ?? []) {
    if (
      prefix.length === 0 ||
      prefix.startsWith("/") ||
      prefix.includes("..") ||
      UNSAFE_ARG.test(prefix.replace(/\/$/, ""))
    ) {
      return {
        ok: false,
        reason: "focused path prefixes must be bounded repository paths",
      };
    }
  }
  return { ok: true };
}

function validateBoundedArgv(argv: readonly string[]): string | undefined {
  if (
    argv.length < 2 ||
    argv.length > 12 ||
    argv.some((argument) => UNSAFE_ARG.test(argument))
  ) {
    return "gate commands must be bounded exact argv without shell syntax or globs";
  }
  const [executable, command] = argv;
  if (executable === "pnpm") {
    if (
      command === undefined ||
      !SAFE_SCRIPT.test(command) ||
      !command.includes(":") ||
      command === "exec" ||
      command === "dlx"
    ) {
      return "pnpm gate commands must name one bounded repository script";
    }
    return undefined;
  }
  if (
    executable === "just" &&
    command !== undefined &&
    SAFE_SCRIPT.test(command)
  ) {
    return undefined;
  }
  return "gate commands must use a bounded pnpm script or Just recipe";
}

export function defineDiagnosticRegistryProjection(
  descriptors: readonly DiagnosticDescriptor[],
): readonly DiagnosticDescriptor[] {
  const gateIds = new Set<string>();
  for (const descriptor of descriptors) {
    const validation = validateDiagnosticDescriptor(descriptor);
    if (!validation.ok)
      throw new Error(`${descriptor.gateId}: ${validation.reason}`);
    if (gateIds.has(descriptor.gateId)) {
      throw new Error(`Duplicate diagnostic gate id: ${descriptor.gateId}`);
    }
    gateIds.add(descriptor.gateId);
  }
  return [...descriptors];
}

export function projectGateDiagnostic(
  descriptor: DiagnosticDescriptor,
  observation: GateDiagnosticObservation,
): ProjectedGateDiagnostic {
  const validation = validateDiagnosticDescriptor(descriptor);
  if (!validation.ok)
    throw new Error(`${descriptor.gateId}: ${validation.reason}`);

  const advisory = descriptor.posture === "advisory";
  const nextAction = `${descriptor.repairHint} See ${descriptor.canonicalDoc}.`;
  return {
    code: descriptor.gateId,
    severity: advisory ? "warning" : "error",
    message: observation.message,
    safeToContinue: advisory,
    nextAction,
    rerun: formatDiagnosticArgv(descriptor.rerun),
    gateId: descriptor.gateId,
    posture: descriptor.posture,
    evidenceClass: descriptor.evidenceClass,
    canonicalDoc: descriptor.canonicalDoc,
    repairHint: descriptor.repairHint,
    rerunArgv: [...descriptor.rerun],
    semanticRuleIds: [...(observation.semanticRuleIds ?? [])],
  };
}

export function formatDiagnosticArgv(argv: readonly string[]): string {
  return argv.join(" ");
}
