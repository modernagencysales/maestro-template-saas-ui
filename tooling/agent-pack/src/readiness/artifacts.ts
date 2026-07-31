import {
  PROVIDER_ENVIRONMENTS,
  migrateLegacyGlobalProviderPosture,
  type LegacyGlobalProviderMode,
} from "@maestro-template/template-core/templateInstance";
import { resolve } from "node:path";
import {
  evaluateReceiptStaleness,
  summarizeVerificationReceipt,
  type EnvironmentFingerprint,
  type ProvidersFingerprint,
  type RepositoryFingerprint,
  type VerificationReceipt,
  type VerificationSubject,
} from "../receipt.js";
import type { RepositoryContext } from "../repoContext.js";
import type {
  BuildReadinessInput,
  ReadinessSurfaceStatus,
} from "./presenter.js";

export type ReadinessPreflightProjection = {
  readonly worksNow: string;
  readonly demoOnly: string;
  readonly safeToStart: boolean;
  readonly diagnostics: readonly { readonly rerun: string }[];
  readonly blueprint: string;
  readonly providers: BuildReadinessInput["providers"];
};

export type ReadinessCurrentFacts = {
  readonly subject: VerificationSubject;
  readonly repositoryFingerprint: RepositoryFingerprint;
  readonly environmentFingerprint: EnvironmentFingerprint;
  readonly providerPostureFingerprint: ProvidersFingerprint;
};

export async function loadBuildReadinessInput(input: {
  readonly repo: RepositoryContext;
  readonly preflight: ReadinessPreflightProjection;
  readonly current: ReadinessCurrentFacts;
  readonly readFile: (path: string) => Promise<string>;
}): Promise<BuildReadinessInput> {
  const instance = parseJson(
    await input.readFile(
      resolve(input.repo.targetRoot, "template-instance.json"),
    ),
    "Template instance",
  );
  const personalization = record(instance.personalization);
  const blueprint = record(instance.blueprint);
  if (
    !nonempty(personalization.name) ||
    !nonempty(personalization.firstOutcome) ||
    typeof personalization.demoOnly !== "boolean" ||
    !nonempty(blueprint.id) ||
    blueprint.id !== input.preflight.blueprint
  ) {
    throw new Error("Template instance readiness facts are invalid.");
  }
  const readiness = parseJson(
    await requiredArtifact(
      input.readFile,
      resolve(
        input.repo.targetRoot,
        "generated",
        "blueprints",
        blueprint.id,
        "readiness.json",
      ),
      "Blueprint readiness artifact",
    ),
    "Blueprint readiness artifact",
  );
  const surfaces = parseSurfaces(readiness.surfaces);
  const automation = record(readiness.automation);
  const receipt = await optionalReceipt(input);
  const providerEnvironments = projectProviderEnvironments(instance);
  return {
    app: {
      name: personalization.name,
      firstOutcome: personalization.firstOutcome,
      demoOnly: personalization.demoOnly,
    },
    blueprint: {
      id: blueprint.id,
      workflowSelected: automation.status === "selected",
    },
    recipe: null,
    preflight: {
      worksNow: input.preflight.worksNow,
      demoOnly: input.preflight.demoOnly,
      safeToStart: input.preflight.safeToStart,
      diagnostics: input.preflight.diagnostics.map(({ rerun }) => ({ rerun })),
    },
    providers: input.preflight.providers.map((provider) => ({ ...provider })),
    providerEnvironments,
    surfaces,
    receipt,
  };
}

function projectProviderEnvironments(
  instance: Record<string, unknown>,
): BuildReadinessInput["providerEnvironments"] {
  const providerMode = instance.providerMode;
  const providerIds = Object.keys(record(instance.providers));
  if (providerMode === undefined && providerIds.length === 0) return [];
  if (!legacyProviderMode(providerMode) || providerIds.length === 0)
    throw new Error("Template instance readiness facts are invalid.");
  const posture = migrateLegacyGlobalProviderPosture({
    providerMode,
    providerIds,
  });
  return PROVIDER_ENVIRONMENTS.map((environment) => ({
    environment,
    providers: Object.entries(posture.providers).map(([id, provider]) => {
      const environmentPosture = provider.environments[environment];
      return {
        id,
        state: environmentPosture.state,
        evidence: environmentPosture.evidence.map(
          ({ secretNames, ...entry }) => ({
            ...entry,
            secretNames: [...secretNames],
          }),
        ),
      };
    }),
  }));
}

function legacyProviderMode(value: unknown): value is LegacyGlobalProviderMode {
  return value === "fake" || value === "test" || value === "live";
}

async function requiredArtifact(
  readFile: (path: string) => Promise<string>,
  path: string,
  label: string,
): Promise<string> {
  try {
    return await readFile(path);
  } catch {
    throw new Error(`${label} is invalid.`);
  }
}

async function optionalReceipt(
  input: Parameters<typeof loadBuildReadinessInput>[0],
): Promise<BuildReadinessInput["receipt"]> {
  let raw: string;
  try {
    raw = await input.readFile(
      resolve(input.repo.targetRoot, ".maestro", "verification-receipt.json"),
    );
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { malformed: true };
  }
  const receipt = parseReceipt(parsed);
  if (receipt === null) return { malformed: true };
  return {
    subject: receipt.subject,
    createdAt: receipt.createdAt,
    status: summarizeVerificationReceipt(receipt).status,
    staleness: evaluateReceiptStaleness(receipt, {
      subject: input.current.subject,
      repositoryFingerprint: input.current.repositoryFingerprint,
      environmentFingerprint: input.current.environmentFingerprint,
      providerPostureFingerprint: input.current.providerPostureFingerprint,
    }),
  };
}

function parseSurfaces(value: unknown): BuildReadinessInput["surfaces"] {
  if (!Array.isArray(value))
    throw new Error("Blueprint readiness artifact is invalid.");
  return value.map((candidate) => {
    const surface = record(candidate);
    if (!nonempty(surface.id) || !surfaceStatus(surface.status))
      throw new Error("Blueprint readiness artifact is invalid.");
    return {
      id: surface.id,
      kind: surfaceKind(surface.id),
      status: surface.status === "unavailable" ? "unverified" : surface.status,
    };
  });
}

function surfaceKind(
  id: string,
): BuildReadinessInput["surfaces"][number]["kind"] {
  if (id === "workspace-membership") return "screen";
  if (id === "fake-record-crud" || id === "local-convex-record-crud")
    return "data";
  if (id === "live-provider") return "connection";
  return "other";
}

function surfaceStatus(
  value: unknown,
): value is ReadinessSurfaceStatus | "unavailable" {
  return ["real", "fake", "seam", "unverified", "unavailable"].includes(
    String(value),
  );
}

function parseReceipt(value: unknown): VerificationReceipt | null {
  const receipt = record(value);
  const command = record(receipt.command);
  const subject = record(receipt.subject);
  const fingerprints = record(receipt.fingerprints);
  const scope = record(receipt.scope);
  if (
    receipt.schemaVersion !== 1 ||
    !nonempty(receipt.createdAt) ||
    !nonempty(command.id) ||
    command.version !== 1 ||
    !nonempty(subject.commit) ||
    typeof subject.dirty !== "boolean" ||
    !prefixed(fingerprints.repository, "repository_sha256:") ||
    !prefixed(fingerprints.environment, "environment_sha256:") ||
    !prefixed(fingerprints.providerPosture, "providers_sha256:") ||
    !validScope(scope) ||
    !Array.isArray(receipt.gates) ||
    !receipt.gates.every(validGate)
  )
    return null;
  return value as VerificationReceipt;
}

function validScope(scope: Record<string, unknown>): boolean {
  if (
    !Array.isArray(scope.changedPaths) ||
    !scope.changedPaths.every((path) => typeof path === "string")
  )
    return false;
  return scope.kind === "full"
    ? scope.partial === false && scope.changedPaths.length === 0
    : scope.kind === "focused" && scope.partial === true;
}

function validGate(value: unknown): boolean {
  const gate = record(value);
  return (
    nonempty(gate.gateId) &&
    (gate.posture === "required" || gate.posture === "advisory") &&
    ["static", "behavioral", "runtime", "live-promotion", "advisory"].includes(
      String(gate.evidenceClass),
    ) &&
    ["pass", "fail", "skipped", "unavailable"].includes(String(gate.status)) &&
    Array.isArray(gate.semanticRuleIds) &&
    gate.semanticRuleIds.every(nonempty)
  );
}

function parseJson(raw: string, label: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value)) return value;
  } catch {
    // The closed diagnostic below owns malformed canonical artifacts.
  }
  throw new Error(`${label} is invalid.`);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function prefixed(value: unknown, prefix: string): value is string {
  return typeof value === "string" && value.startsWith(prefix);
}
