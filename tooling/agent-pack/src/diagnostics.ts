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
  readonly defaultFocused?: boolean;
  readonly prerequisiteCheck?: readonly [string, ...string[]];
  readonly semanticRuleIds?: readonly string[];
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
const SAFE_SEMANTIC_RULE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
const SAFE_DOC =
  /^(?:docs|agent-patterns)\/[a-zA-Z0-9._/-]+\.md(?:#[a-z0-9-]+)?$/;
const SAFE_SCRIPT = /^[a-z0-9][a-z0-9:_-]*$/;
const UNSAFE_ARG = /[\s;&|`$<>*?{}[\]\\\n\r]/;
const DIRECT_EXECUTABLES = new Set(["gitleaks"]);

export function validateDiagnosticDescriptor(
  descriptor: DiagnosticDescriptor,
): DescriptorValidation {
  const metadataError = validateDiagnosticMetadata(descriptor);
  if (metadataError !== undefined) return { ok: false, reason: metadataError };
  const commandError =
    validateBoundedArgv(descriptor.argv) ??
    validateBoundedArgv(descriptor.rerun);
  if (commandError !== undefined) return { ok: false, reason: commandError };
  const prerequisiteError = validatePrerequisite(descriptor.prerequisiteCheck);
  if (prerequisiteError !== undefined)
    return { ok: false, reason: prerequisiteError };
  const focusedPathError = validateFocusedPaths(descriptor.focusedPathPrefixes);
  if (focusedPathError !== undefined)
    return { ok: false, reason: focusedPathError };
  const semanticRuleError = validateSemanticRuleIds(descriptor.semanticRuleIds);
  if (semanticRuleError !== undefined)
    return { ok: false, reason: semanticRuleError };
  return { ok: true };
}

function validateDiagnosticMetadata(
  descriptor: DiagnosticDescriptor,
): string | undefined {
  if (!SAFE_ID.test(descriptor.gateId)) {
    return "gateId must be a stable, path-safe identifier";
  }
  if (
    !SAFE_DOC.test(descriptor.canonicalDoc) ||
    descriptor.canonicalDoc.includes("..")
  ) {
    return "canonicalDoc must be a repository documentation path";
  }
  return UNSAFE_REPAIR.test(descriptor.repairHint)
    ? "repairHint must repair the invariant, never edit, disable, skip, or weaken a gate"
    : undefined;
}

function validatePrerequisite(
  prerequisite: DiagnosticDescriptor["prerequisiteCheck"],
): string | undefined {
  return prerequisite === undefined
    ? undefined
    : validatePrerequisiteArgv(prerequisite);
}

function validateFocusedPaths(
  prefixes: DiagnosticDescriptor["focusedPathPrefixes"],
): string | undefined {
  return (prefixes ?? []).some(
    (prefix) =>
      prefix.length === 0 ||
      prefix.startsWith("/") ||
      prefix.includes("..") ||
      UNSAFE_ARG.test(prefix.replace(/\/$/, "")),
  )
    ? "focused path prefixes must be bounded repository paths"
    : undefined;
}

function validateSemanticRuleIds(
  semanticRuleIds: DiagnosticDescriptor["semanticRuleIds"],
): string | undefined {
  return (semanticRuleIds ?? []).every((id) => SAFE_SEMANTIC_RULE_ID.test(id))
    ? undefined
    : "semantic rule ids must be stable, path-safe identifiers";
}

function validatePrerequisiteArgv(argv: readonly string[]): string | undefined {
  const [executable] = argv;
  if (
    argv.length < 1 ||
    argv.length > 4 ||
    executable === undefined ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(executable) ||
    argv.some((argument) => UNSAFE_ARG.test(argument))
  ) {
    return "gate prerequisites must use one bounded executable argument array";
  }
  return undefined;
}

function validateBoundedArgv(argv: readonly string[]): string | undefined {
  if (!isBoundedArgv(argv)) {
    return "gate commands must be bounded exact argv without shell syntax or globs";
  }
  const [executable, command] = argv;
  if (executable === "pnpm") return validatePnpmArgv(argv, command);
  return isDirectExecutable(executable)
    ? undefined
    : "gate commands must use a bounded executable or pnpm script";
}

function isBoundedArgv(argv: readonly string[]): boolean {
  return (
    argv.length >= 2 &&
    argv.length <= 12 &&
    !argv.some((argument) => UNSAFE_ARG.test(argument))
  );
}

function validatePnpmArgv(
  argv: readonly string[],
  command: string | undefined,
): string | undefined {
  return command === "--dir"
    ? validatePnpmDirectoryArgv(argv)
    : isRootPnpmScript(argv, command)
      ? undefined
      : "pnpm gate commands must name one bounded repository script";
}

function validatePnpmDirectoryArgv(
  argv: readonly string[],
): string | undefined {
  const [, , directory, script] = argv;
  return isPackageDirectory(directory) && isPackageScript(script)
    ? undefined
    : "pnpm --dir gate commands must name a bounded package path and script";
}

function isPackageDirectory(directory: string | undefined): boolean {
  return (
    directory !== undefined &&
    !directory.startsWith("/") &&
    !directory.includes("..") &&
    /^[a-zA-Z0-9._/-]+$/.test(directory)
  );
}

function isPackageScript(script: string | undefined): boolean {
  return (
    script !== undefined && SAFE_SCRIPT.test(script) && !isPnpmEscape(script)
  );
}

function isRootPnpmScript(
  argv: readonly string[],
  command: string | undefined,
): boolean {
  return (
    argv.length === 2 &&
    command !== undefined &&
    command.includes(":") &&
    isPackageScript(command)
  );
}

function isPnpmEscape(command: string): boolean {
  return command === "exec" || command === "dlx";
}

function isDirectExecutable(executable: string | undefined): boolean {
  return executable !== undefined && DIRECT_EXECUTABLES.has(executable);
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
