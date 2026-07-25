import { access, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export type EvaluationHost = "claude" | "codex";

export const requiredCommandIds = [
  "install",
  "create",
  "start",
  "add_crud",
  "create_record",
  "read_record",
  "check",
] as const;

export const requiredMilestoneIds = [
  "prerequisites_install_complete",
  "visible_fake_url",
  "personalized_interaction",
  "first_record_persisted",
  "check_complete",
] as const;

export type WalkingSkeletonResult = {
  readonly schemaVersion: 1;
  readonly status: "passed" | "failed";
  readonly candidateSha: string;
  readonly customerTarget: string;
  readonly milestones: readonly {
    readonly id: string;
    readonly reachedAt: string;
  }[];
  readonly commands: readonly {
    readonly id: string;
    readonly status: "passed" | "failed";
    readonly summary: string;
  }[];
  readonly interventions: readonly {
    readonly kind: "product-naming" | "dependency-approval" | "auth-approval";
    readonly summary: string;
  }[];
  readonly evidence: {
    readonly visibleUrl: string;
    readonly recordId: string;
    readonly manifestPath: string;
    readonly receiptPath: string;
    readonly verticalSlicePaths: readonly string[];
  };
  readonly posture: {
    readonly fakeLocalOnly: boolean;
    readonly usedPlugin: boolean;
    readonly usedMcp: boolean;
    readonly usedWorkflow: boolean;
    readonly productionAccess: boolean;
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
};

export class EvaluationError extends Error {
  constructor(
    readonly code:
      | "EVAL_INVALID_ARGUMENT"
      | "EVAL_OUTPUT_EXISTS"
      | "EVAL_HOST_EXECUTABLE_UNAVAILABLE"
      | "EVAL_HOST_AUTH_REQUIRED"
      | "EVAL_HOST_EXECUTION_FAILED"
      | "EVAL_RESULT_MISSING"
      | "EVAL_RESULT_INVALID"
      | "EVAL_ASSERTION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "EvaluationError";
  }
}

export const walkingSkeletonScenario = {
  id: "walking-skeleton",
  steps: [
    "Install prerequisites and frozen dependencies from the clean clone.",
    "Create a personalized customer target named from the supplied product name.",
    "Start the fake/local app and prove a visible loopback URL.",
    "Add one CRUD business outcome through the canonical Maestro authoring surface.",
    "Create and read the first local record.",
    "Run the canonical check command without weakening any gate.",
    "Explain what works, what remains demo-only, and the single next action.",
  ],
} as const;

export function buildWalkingSkeletonPrompt(input: {
  readonly candidateSha: string;
  readonly productName: string;
  readonly resultPath: string;
}): string {
  return `You are independently evaluating Maestro from a clean clone at commit ${input.candidateSha}.

Build a small app named ${JSON.stringify(input.productName)}. Follow committed repo instructions and skills only. Do not require a plugin, MCP, workflow, provider account, production access, or architecture rescue. Do not edit or weaken gates. Use fake/local mode.

Required journey:
${walkingSkeletonScenario.steps.map((step, index) => `${String(index + 1)}. ${step}`).join("\n")}

Write the final evidence as strict JSON to ${input.resultPath}. Use schemaVersion 1 and include: status; candidateSha; customerTarget; every required milestone with an ISO reachedAt; every required command with passed/failed and a safe summary; interventions limited to product-naming, dependency-approval, or auth-approval; evidence with loopback visibleUrl, recordId, relative manifestPath, relative receiptPath, and relative verticalSlicePaths; posture booleans fakeLocalOnly, usedPlugin, usedMcp, usedWorkflow, productionAccess; and explanation strings works, demoOnly, nextAction. Do not put secrets or environment values in the result.`;
}

export async function gradeWalkingSkeleton(input: {
  readonly result: WalkingSkeletonResult;
  readonly workspace: string;
  readonly candidateSha: string;
  readonly startedAt: string;
}): Promise<WalkingSkeletonVerdict> {
  const failures: AssertionFailure[] = [];
  const fail = (code: string, message: string): void => {
    failures.push({ code, message });
  };
  const { result } = input;

  if (result.schemaVersion !== 1 || result.status !== "passed") {
    fail(
      "RESULT_NOT_PASSED",
      "The host did not report a schema-v1 passed run.",
    );
  }
  if (result.candidateSha !== input.candidateSha) {
    fail(
      "CANDIDATE_SHA_MISMATCH",
      "The result does not name the pinned candidate SHA.",
    );
  }

  for (const id of requiredCommandIds) {
    const matches = result.commands.filter((entry) => entry.id === id);
    if (matches.length !== 1 || matches[0]?.status !== "passed") {
      fail(
        "COMMAND_EVIDENCE_MISSING",
        `Required command ${id} did not pass exactly once.`,
      );
    }
  }
  const allowedInterventions = new Set([
    "product-naming",
    "dependency-approval",
    "auth-approval",
  ]);
  for (const intervention of result.interventions) {
    if (
      !allowedInterventions.has(intervention.kind) ||
      intervention.summary.trim().length === 0
    ) {
      fail(
        "INTERVENTION_BUDGET_EXCEEDED",
        "A run required an unapproved or unexplained intervention.",
      );
    }
  }

  const milestoneTimes = new Map<string, number>();
  let previous = Date.parse(input.startedAt);
  for (const id of requiredMilestoneIds) {
    const matches = result.milestones.filter((entry) => entry.id === id);
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
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/u.test(
      result.evidence.visibleUrl,
    )
  ) {
    fail(
      "VISIBLE_URL_NOT_LOCAL",
      "Visible app evidence must use a loopback URL.",
    );
  }
  if (result.evidence.recordId.trim().length === 0) {
    fail("FIRST_RECORD_MISSING", "First persisted-record evidence is empty.");
  }
  if (
    !result.posture.fakeLocalOnly ||
    result.posture.usedPlugin ||
    result.posture.usedMcp ||
    result.posture.usedWorkflow ||
    result.posture.productionAccess
  ) {
    fail(
      "POSTURE_VIOLATION",
      "The alpha must remain fake/local and require no plugin, MCP, workflow, or production access.",
    );
  }
  if (
    [
      result.explanation.works,
      result.explanation.demoOnly,
      result.explanation.nextAction,
    ].some((value) => value.trim().length === 0)
  ) {
    fail(
      "EXPLANATION_INCOMPLETE",
      "Works, demo-only, and next-action explanations are required.",
    );
  }

  const evidencePaths = [
    result.evidence.manifestPath,
    result.evidence.receiptPath,
    ...result.evidence.verticalSlicePaths,
  ];
  if (result.evidence.verticalSlicePaths.length === 0) {
    fail(
      "VERTICAL_SLICE_MISSING",
      "At least one vertical-slice artifact is required.",
    );
  }
  for (const path of evidencePaths) {
    const absolute = safeWorkspacePath(input.workspace, path);
    if (!absolute) {
      fail(
        "EVIDENCE_PATH_UNSAFE",
        `Evidence path is outside the workspace: ${path}`,
      );
      continue;
    }
    try {
      await access(absolute);
    } catch {
      fail("EVIDENCE_PATH_MISSING", `Evidence path does not exist: ${path}`);
    }
  }

  const customerRoot = safeWorkspacePath(
    input.workspace,
    result.customerTarget,
  );
  if (!customerRoot) {
    fail(
      "CUSTOMER_TARGET_UNSAFE",
      "Customer target must be a relative workspace path.",
    );
  } else {
    await findFactoryLeakage(customerRoot, failures);
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
  };
}

export function parseWalkingSkeletonResult(
  value: unknown,
): WalkingSkeletonResult {
  if (!isRecord(value)) {
    throw new EvaluationError(
      "EVAL_RESULT_INVALID",
      "Host result must be a JSON object.",
    );
  }
  const requiredObjects = ["evidence", "posture", "explanation"];
  if (
    value.schemaVersion !== 1 ||
    (value.status !== "passed" && value.status !== "failed") ||
    typeof value.candidateSha !== "string" ||
    typeof value.customerTarget !== "string" ||
    !Array.isArray(value.milestones) ||
    !Array.isArray(value.commands) ||
    !Array.isArray(value.interventions) ||
    requiredObjects.some((key) => !isRecord(value[key]))
  ) {
    throw new EvaluationError(
      "EVAL_RESULT_INVALID",
      "Host result is missing required walking-skeleton fields.",
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

function safeWorkspacePath(workspace: string, path: string): string | null {
  if (path.trim().length === 0 || isAbsolute(path)) return null;
  const absolute = resolve(workspace, path);
  const fromWorkspace = relative(workspace, absolute);
  return fromWorkspace === ".." ||
    fromWorkspace.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    ? null
    : absolute;
}

async function findFactoryLeakage(
  customerRoot: string,
  failures: AssertionFailure[],
): Promise<void> {
  const forbidden = new Set([
    "tooling/agent-pack",
    "apps/cli/src/factory",
    ".claude-plugin",
  ]);
  const walk = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      failures.push({
        code: "CUSTOMER_TARGET_MISSING",
        message: "Customer target directory is missing.",
      });
      return;
    }
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const relativePath = relative(customerRoot, path).replaceAll("\\", "/");
      if (
        [...forbidden].some(
          (item) =>
            relativePath === item || relativePath.startsWith(`${item}/`),
        )
      ) {
        failures.push({
          code: "FACTORY_LEAKAGE",
          message: `Factory-only path found: ${relativePath}`,
        });
      }
      if (
        entry.isDirectory() &&
        entry.name !== "node_modules" &&
        entry.name !== ".git"
      ) {
        await walk(path);
      }
    }
  };
  await walk(customerRoot);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
