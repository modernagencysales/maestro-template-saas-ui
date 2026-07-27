export type EvaluationHost = "claude" | "codex";

export const requiredMilestoneIds = [
  "prerequisites_install_complete",
  "visible_fake_url",
  "personalized_interaction",
  "first_record_persisted",
  "check_complete",
] as const;

export type WalkingSkeletonResult = {
  readonly schemaVersion: 2;
  readonly candidateSha: string;
  readonly customerTarget: string;
  readonly milestones: readonly {
    readonly id: string;
    readonly reachedAt: string;
  }[];
  readonly interventions: readonly {
    readonly kind: "product-naming" | "dependency-approval" | "auth-approval";
    readonly summary: string;
  }[];
  readonly evidence: {
    readonly manifestPath: string;
    readonly receiptPath: string;
  };
  readonly explanation: {
    readonly works: string;
    readonly demoOnly: string;
    readonly nextAction: string;
  };
};

export type AssertionFailure = {
  readonly code: string;
  readonly message: string;
};
export type CanonicalEvidenceHashes = {
  readonly manifest: string;
  readonly gateSet: string;
  readonly verticalSlice: string;
  readonly firstRecord: string;
  readonly checkExecution: string;
};
export type BrowserOpener = "open" | "xdg-open" | "explorer.exe";
export type BrowserOpenResult =
  | {
      readonly status: "opened";
      readonly opener: BrowserOpener;
    }
  | {
      readonly status: "headless-fallback";
      readonly reason: "opener-failed" | "unsupported-platform";
      readonly opener?: BrowserOpener;
    };
export type BrowserOpenEvidence = BrowserOpenResult & {
  readonly proofUrl: string;
};
export type ExecutableEvidence = {
  readonly canonicalHashes: CanonicalEvidenceHashes;
  readonly browserOpen: BrowserOpenEvidence;
  readonly serverProof: {
    readonly url: string;
    readonly statusCode: number;
    readonly responseBytes: number;
    readonly bodySha256: string;
    readonly source: "live-probe" | "captured-proof";
  };
};
export type WalkingSkeletonVerdict = {
  readonly status: "passed" | "failed";
  readonly failures: readonly AssertionFailure[];
  readonly durationsMs: {
    readonly install: number;
    readonly url: number;
    readonly personalized: number;
    readonly firstRecord: number;
    readonly total: number;
  } | null;
  readonly executableEvidence?: ExecutableEvidence;
};

export type EvaluationErrorCode =
  | "EVAL_INVALID_ARGUMENT"
  | "EVAL_OUTPUT_EXISTS"
  | "EVAL_HOST_EXECUTABLE_UNAVAILABLE"
  | "EVAL_HOST_AUTH_REQUIRED"
  | "EVAL_HOST_ISOLATION_UNAVAILABLE"
  | "EVAL_HOST_EXECUTION_FAILED"
  | "EVAL_RESULT_MISSING"
  | "EVAL_RESULT_INVALID"
  | "EVAL_ASSERTION_FAILED"
  | "EVAL_PREREQUISITE_EVIDENCE_MISSING"
  | "EVAL_MANIFEST_INVALID"
  | "EVAL_GATE_RECEIPT_INVALID"
  | "EVAL_VERTICAL_SLICE_INVALID"
  | "EVAL_RECORD_EVIDENCE_INVALID"
  | "EVAL_BROWSER_PROOF_UNAVAILABLE"
  | "EVAL_PRODUCT_PROOF_UNAVAILABLE"
  | "EVAL_FORBIDDEN_HOST_CONFIG"
  | "EVAL_PROVENANCE_CHANGED"
  | "EVAL_SUITE_INCOMPLETE"
  | "EVAL_SUITE_DIVERGED";

export class EvaluationError extends Error {
  constructor(
    readonly code: EvaluationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EvaluationError";
  }
}

export const walkingSkeletonScenario = {
  id: "walking-skeleton",
  steps: [
    "Install frozen dependencies from the clean clone.",
    "Create a personalized customer target.",
    "Start the fake/local app and keep its loopback URL reachable for verification.",
    "Add one CRUD vertical slice through the canonical Maestro authoring surface.",
    "Create and read a non-synthetic first record, persisted as JSON evidence.",
    "Run pnpm maestro -- check --mode fake and retain its verification receipt.",
    "Explain what works, what remains demo-only, and the single next action.",
  ],
} as const;

export function buildWalkingSkeletonPrompt(input: {
  readonly candidateSha: string;
  readonly productName: string;
  readonly resultPath: string;
}): string {
  return `You are independently evaluating Maestro from a clean clone at commit ${input.candidateSha}.

Build a small app named ${JSON.stringify(input.productName)}. Follow committed repo instructions and skills only. Use fake/local mode. Do not install or enable plugins or MCP, use workflows, access a provider or production, edit tracked factory files, or weaken gates. The harness will independently rerun checks, validate files, probe the URL, inspect provenance, and discard the workspace.

Required journey:
${walkingSkeletonScenario.steps.map((step, index) => `${String(index + 1)}. ${step}`).join("\n")}

Write strict JSON schemaVersion 2 to ${input.resultPath}. Include candidateSha; relative customerTarget; the five required milestones with ISO reachedAt; interventions limited to product-naming, dependency-approval, or auth-approval; evidence with manifestPath pointing to the generated target's template-instance.json and receiptPath pointing to its verification receipt; and explanation strings works, demoOnly, nextAction. Do not manufacture record, server, or vertical-slice proof: the harness will require a product-owned local CRUD proof command after you exit. Do not put secrets or environment values in evidence.`;
}

export function gradeHostReport(input: {
  readonly result: WalkingSkeletonResult;
  readonly candidateSha: string;
  readonly startedAt: string;
  readonly executableEvidence: ExecutableEvidence;
}): WalkingSkeletonVerdict {
  const failures: AssertionFailure[] = [];
  const fail = (code: string, message: string): void => {
    failures.push({ code, message });
  };
  if (input.result.candidateSha !== input.candidateSha) {
    fail(
      "CANDIDATE_SHA_MISMATCH",
      "The host result does not name the pinned candidate SHA.",
    );
  }
  const allowedInterventions = new Set([
    "product-naming",
    "dependency-approval",
    "auth-approval",
  ]);
  for (const intervention of input.result.interventions) {
    if (
      !allowedInterventions.has(intervention.kind) ||
      intervention.summary.trim().length === 0
    ) {
      fail(
        "INTERVENTION_BUDGET_EXCEEDED",
        "The run required an unapproved intervention.",
      );
    }
  }
  const milestoneTimes = new Map<string, number>();
  let previous = Date.parse(input.startedAt);
  for (const id of requiredMilestoneIds) {
    const matches = input.result.milestones.filter((entry) => entry.id === id);
    const parsed =
      matches.length === 1
        ? Date.parse(matches[0]?.reachedAt ?? "")
        : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < previous) {
      fail("MILESTONE_INVALID", `Milestone ${id} is missing or non-monotonic.`);
      continue;
    }
    milestoneTimes.set(id, parsed);
    previous = parsed;
  }
  if (
    [
      input.result.explanation.works,
      input.result.explanation.demoOnly,
      input.result.explanation.nextAction,
    ].some((value) => value.trim().length === 0)
  ) {
    fail(
      "EXPLANATION_INCOMPLETE",
      "Works, demo-only, and next-action explanations are required.",
    );
  }
  const started = Date.parse(input.startedAt);
  const install = milestoneTimes.get("prerequisites_install_complete");
  const url = milestoneTimes.get("visible_fake_url");
  const personalized = milestoneTimes.get("personalized_interaction");
  const firstRecord = milestoneTimes.get("first_record_persisted");
  const total = milestoneTimes.get("check_complete");
  const durationsMs = [
    started,
    install,
    url,
    personalized,
    firstRecord,
    total,
  ].every((value) => value !== undefined && Number.isFinite(value))
    ? {
        install: (install as number) - started,
        url: (url as number) - started,
        personalized: (personalized as number) - started,
        firstRecord: (firstRecord as number) - started,
        total: (total as number) - started,
      }
    : null;
  return {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    durationsMs,
    executableEvidence: input.executableEvidence,
  };
}

export function parseWalkingSkeletonResult(
  value: unknown,
): WalkingSkeletonResult {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.candidateSha !== "string" ||
    typeof value.customerTarget !== "string" ||
    !Array.isArray(value.milestones) ||
    !Array.isArray(value.interventions) ||
    !isRecord(value.evidence) ||
    !isRecord(value.explanation)
  ) {
    throw new EvaluationError(
      "EVAL_RESULT_INVALID",
      "Host result is not walking-skeleton schemaVersion 2.",
    );
  }
  const evidence = value.evidence;
  if (
    ![evidence.manifestPath, evidence.receiptPath].every(
      (entry) => typeof entry === "string" && entry.length > 0,
    )
  ) {
    throw new EvaluationError(
      "EVAL_RESULT_INVALID",
      "Host result evidence is incomplete.",
    );
  }
  return value as WalkingSkeletonResult;
}

export function redactText(input: string): string {
  return input
    .replace(/\b(Bearer)\s+[^\s"']+/giu, "$1 [REDACTED]")
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY))=([^\s]+)/gu,
      "$1=[REDACTED]",
    )
    .replace(
      /\b(sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/gu,
      "[REDACTED]",
    );
}

export function redactJson(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /secret|token|password|authorization|api.?key/iu.test(key)
        ? "[REDACTED]"
        : redactJson(entry),
    ]),
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
