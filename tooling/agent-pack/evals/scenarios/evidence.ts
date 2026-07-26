import type { ForbiddenActionId } from "../assertions/forbiddenActions.js";
import type { ForwardScenarioId } from "./forward.js";

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
    readonly outputSha256: `sha256:${string}`;
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
  "candidateSha" | "scenarioId" | "artifacts" | "commands" | "receiptSha256"
>;
