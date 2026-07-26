import {
  forbiddenActionIds,
  type ForbiddenActionId,
} from "../assertions/forbiddenActions.js";
import { forwardScenarioIds, type ForwardScenarioId } from "./forward.js";

export type ForwardHost = "claude" | "codex";

export type ForwardInterventionKind =
  "product-approval" | "provider-approval" | "external-authentication";

export type ForwardRunEvidence = {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
  readonly host: ForwardHost;
  readonly hostVersion: string;
  readonly model: string;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly initialContextSha256: `sha256:${string}`;
  readonly userPromptSha256: `sha256:${string}`;
  readonly interventions: readonly {
    readonly kind: ForwardInterventionKind;
    readonly summary: string;
  }[];
  readonly artifacts: readonly {
    readonly id: string;
    readonly sha256: `sha256:${string}`;
  }[];
  readonly commands: readonly {
    readonly id: string;
    readonly exitCode: number;
    readonly resultCode: string;
    readonly attestationSha256: `sha256:${string}`;
  }[];
  readonly timings: readonly {
    readonly id: string;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly durationMs: number;
  }[];
  readonly forbiddenActions: readonly {
    readonly id: ForbiddenActionId;
    readonly observed: boolean;
    readonly evidence: readonly string[];
  }[];
  readonly receiptSha256: `sha256:${string}`;
};

export type ForwardCanonicalProjection = Pick<
  ForwardRunEvidence,
  | "candidateSha"
  | "scenarioId"
  | "artifacts"
  | "commands"
  | "forbiddenActions"
  | "receiptSha256"
>;

const evidenceKeys = [
  "schemaVersion",
  "runId",
  "candidateSha",
  "scenarioId",
  "host",
  "hostVersion",
  "model",
  "toolVersions",
  "initialContextSha256",
  "userPromptSha256",
  "interventions",
  "artifacts",
  "commands",
  "timings",
  "forbiddenActions",
  "receiptSha256",
] as const;
const interventionKinds = new Set<ForwardInterventionKind>([
  "product-approval",
  "provider-approval",
  "external-authentication",
]);
const scenarioIds = new Set<string>(forwardScenarioIds);
const actionIds = new Set<string>(forbiddenActionIds);

export function parseForwardRunEvidence(value: unknown): ForwardRunEvidence {
  const root = exactRecord(value, evidenceKeys, "evidence");
  requireValue(root.schemaVersion === 1, "evidence.schemaVersion is invalid");
  requireString(root.runId, "evidence.runId");
  requireValue(
    typeof root.candidateSha === "string" &&
      /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(root.candidateSha),
    "evidence.candidateSha is invalid",
  );
  requireValue(
    typeof root.scenarioId === "string" && scenarioIds.has(root.scenarioId),
    "evidence.scenarioId is unknown",
  );
  requireValue(
    root.host === "claude" || root.host === "codex",
    "evidence.host is unknown",
  );
  requireString(root.hostVersion, "evidence.hostVersion");
  requireString(root.model, "evidence.model");
  const toolVersions = record(root.toolVersions, "evidence.toolVersions");
  for (const [key, entry] of Object.entries(toolVersions)) {
    requireString(key, "evidence.toolVersions key");
    requireString(entry, `evidence.toolVersions.${key}`);
  }
  requireHash(root.initialContextSha256, "evidence.initialContextSha256");
  requireHash(root.userPromptSha256, "evidence.userPromptSha256");
  const interventions = array(root.interventions, "evidence.interventions");
  for (const [index, entry] of interventions.entries()) {
    const item = exactRecord(
      entry,
      ["kind", "summary"],
      `evidence.interventions.${String(index)}`,
    );
    requireValue(
      typeof item.kind === "string" &&
        interventionKinds.has(item.kind as ForwardInterventionKind),
      `evidence.interventions.${String(index)}.kind is unknown`,
    );
    requireString(
      item.summary,
      `evidence.interventions.${String(index)}.summary`,
    );
  }
  parseIdentifiedArray(
    root.artifacts,
    "artifacts",
    ["id", "sha256"],
    (item, path) => requireHash(item.sha256, `${path}.sha256`),
  );
  parseIdentifiedArray(
    root.commands,
    "commands",
    ["id", "exitCode", "resultCode", "attestationSha256"],
    (item, path) => {
      requireValue(
        Number.isInteger(item.exitCode),
        `${path}.exitCode is invalid`,
      );
      requireString(item.resultCode, `${path}.resultCode`);
      requireHash(item.attestationSha256, `${path}.attestationSha256`);
    },
  );
  parseIdentifiedArray(
    root.timings,
    "timings",
    ["id", "startedAt", "completedAt", "durationMs"],
    (item, path) => {
      requireTimestamp(item.startedAt, `${path}.startedAt`);
      requireTimestamp(item.completedAt, `${path}.completedAt`);
      requireValue(
        typeof item.durationMs === "number" &&
          Number.isFinite(item.durationMs) &&
          item.durationMs >= 0,
        `${path}.durationMs is invalid`,
      );
    },
  );
  parseIdentifiedArray(
    root.forbiddenActions,
    "forbiddenActions",
    ["id", "observed", "evidence"],
    (item, path) => {
      requireValue(
        typeof item.id === "string" && actionIds.has(item.id),
        `${path}.id is unknown`,
      );
      requireValue(
        typeof item.observed === "boolean",
        `${path}.observed is invalid`,
      );
      for (const [index, evidence] of array(
        item.evidence,
        `${path}.evidence`,
      ).entries()) {
        requireString(evidence, `${path}.evidence.${String(index)}`);
      }
    },
  );
  requireHash(root.receiptSha256, "evidence.receiptSha256");
  return value as ForwardRunEvidence;
}

function parseIdentifiedArray(
  value: unknown,
  name: string,
  keys: readonly string[],
  validate: (item: Record<string, unknown>, path: string) => void,
): void {
  const seen = new Set<string>();
  for (const [index, entry] of array(value, `evidence.${name}`).entries()) {
    const path = `evidence.${name}.${String(index)}`;
    const item = exactRecord(entry, keys, path);
    requireString(item.id, `${path}.id`);
    requireValue(!seen.has(item.id), `${path}.id is duplicated`);
    seen.add(item.id);
    validate(item, path);
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
): Record<string, unknown> {
  const item = record(value, path);
  const expected = new Set(keys);
  for (const key of Object.keys(item)) {
    requireValue(expected.has(key), `${path}.${key} is unknown`);
  }
  for (const key of keys) {
    requireValue(Object.hasOwn(item, key), `${path}.${key} is missing`);
  }
  return item;
}

function record(value: unknown, path: string): Record<string, unknown> {
  requireValue(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${path} must be an object`,
  );
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): readonly unknown[] {
  requireValue(Array.isArray(value), `${path} must be an array`);
  return value as readonly unknown[];
}

function requireString(value: unknown, path: string): asserts value is string {
  requireValue(
    typeof value === "string" && value.length > 0,
    `${path} is invalid`,
  );
}

function requireHash(value: unknown, path: string): void {
  requireValue(
    typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value),
    `${path} is invalid`,
  );
}

function requireTimestamp(value: unknown, path: string): void {
  requireValue(
    typeof value === "string" && Number.isFinite(Date.parse(value)),
    `${path} is invalid`,
  );
}

function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
