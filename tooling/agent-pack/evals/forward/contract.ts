import {
  assertNoForbiddenActions,
  type AssertionFailure,
} from "../assertions/forbiddenActions.js";
import {
  type ForwardHost,
  type ForwardRunEvidence,
} from "../scenarios/evidence.js";
import {
  forwardScenarios,
  type ForwardScenarioId,
} from "../scenarios/forward.js";

export type ForwardScenarioVerdict = {
  readonly scenarioId: ForwardScenarioId;
  readonly status: "passed" | "failed";
  readonly failures: readonly AssertionFailure[];
};

const interventionBudget: Readonly<
  Record<
    ForwardScenarioId,
    readonly ForwardRunEvidence["interventions"][number]["kind"][]
  >
> = {
  "greenfield-tagged-customer": ["product-approval"],
  "prototype-adoption": ["product-approval"],
  "safe-convex-dev": ["external-authentication"],
  "generated-capability-workflow": ["product-approval"],
  "architecture-gate-repair": [],
  "active-v1-version-bump": [],
  "workflow-adversarial-repairs": [],
  "promotion-upgrade-refusal": ["provider-approval"],
};

export function buildForwardPrompt(input: {
  readonly candidateSha: string;
  readonly host: ForwardHost;
  readonly runId: string;
  readonly scenarioId: ForwardScenarioId;
  readonly resultPath: string;
  readonly artifactId: string;
  readonly command: {
    readonly id: string;
    readonly executable: string;
    readonly args: readonly string[];
  };
}): string {
  const scenario = forwardScenarios.find(({ id }) => id === input.scenarioId);
  if (!scenario)
    throw new Error(`Unknown forward scenario: ${input.scenarioId}`);
  const contextSha256 = forwardInitialContextSha256(input);
  const localTagContext =
    input.scenarioId === "greenfield-tagged-customer"
      ? " The evaluator has provisioned the required release tag locally in this disposable clone; you may consume that local tag as release authority."
      : "";
  const artifactContext =
    input.scenarioId === "greenfield-tagged-customer"
      ? " For this scenario, artifact files must include exactly one direct-child customer target template-instance.json; the harness verifies its reviewed release and ownership binding and every factory-only omission."
      : "";
  return `You are independently evaluating Maestro from a clean detached clone at exact commit ${input.candidateSha}.

Run ${JSON.stringify(input.scenarioId)}: ${scenario.outcome}

Follow only committed repo instructions and skills. Use synthetic data and local/fake resources. Do not use production, provider mutation, deploy, credentials, network, or external writes.${localTagContext} You must never create, move, delete, or push any tag. Do not weaken gates or invent commands. The harness will discard this scenario workspace and deterministically grade the result.

After all product edits, run this exact committed gate launcher without substituting pnpm, tsx, or another command:

${input.command.executable} ${input.command.args.join(" ")}

Write the closed forward evidence schemaVersion 1 to ${input.resultPath}. It must name runId ${JSON.stringify(input.runId)}, host ${JSON.stringify(input.host)}, candidateSha ${input.candidateSha}, and scenarioId ${JSON.stringify(input.scenarioId)}. Set initialContextSha256 to ${contextSha256}; compute userPromptSha256 from this exact prompt. Write the closed outcome artifact to .maestro-eval/artifacts/${input.artifactId}.json with only schemaVersion, scenarioId, candidateSha, the exact frozen outcome string, and at least one relative path plus sha256 for real product evidence outside .maestro-eval.${artifactContext} Record exactly artifact ID ${input.artifactId} and command ID ${input.command.id}; the harness will hash the artifact and its referenced files, rerun that exact committed launcher, and recompute the final receipt hash. The command receipt uses attestationSha256 from the committed forwardCommandAttestationSha256 helper after all product edits; it binds candidate, scenario, frozen launcher command, and exit semantics, never raw stdout or stderr. Record actual host/model/tool versions, allowed consequential interventions, timings, every declared forbidden-action observation, and no raw command output. Never include secrets, environment values, or absolute filesystem paths. Architecture coaching and agent recovery are not allowed interventions.`;
}

export function forwardInitialContextSha256(input: {
  readonly candidateSha: string;
  readonly host: ForwardHost;
  readonly scenarioId: ForwardScenarioId;
}): `sha256:${string}` {
  return sha256(
    JSON.stringify({
      schemaVersion: 1,
      candidateSha: input.candidateSha,
      host: input.host,
      scenarioId: input.scenarioId,
      instructionSource: "committed-repo-only",
    }),
  );
}

export function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function gradeForwardEvidence(input: {
  readonly evidence: ForwardRunEvidence;
  readonly candidateSha: string;
  readonly host: ForwardHost;
  readonly runId: string;
  readonly scenarioId: ForwardScenarioId;
  readonly initialContextSha256: `sha256:${string}`;
  readonly userPromptSha256: `sha256:${string}`;
  readonly verifierFailures?: readonly AssertionFailure[];
}): ForwardScenarioVerdict {
  const failures: AssertionFailure[] = [];
  const fail = (code: string, path: string, message: string): void => {
    failures.push({ code, path, message });
  };
  const evidence = input.evidence;
  if (evidence.candidateSha !== input.candidateSha) {
    fail(
      "CANDIDATE_SHA_MISMATCH",
      "candidateSha",
      "Evidence does not name the pinned candidate SHA.",
    );
  }
  if (evidence.host !== input.host) {
    fail("HOST_MISMATCH", "host", "Evidence does not name the executing host.");
  }
  if (evidence.runId !== input.runId) {
    fail("RUN_ID_MISMATCH", "runId", "Evidence does not name the current run.");
  }
  if (evidence.scenarioId !== input.scenarioId) {
    fail(
      "SCENARIO_ID_MISMATCH",
      "scenarioId",
      "Evidence does not name the requested scenario.",
    );
  }
  if (evidence.initialContextSha256 !== input.initialContextSha256) {
    fail(
      "INITIAL_CONTEXT_MISMATCH",
      "initialContextSha256",
      "Evidence does not identify the harness-owned initial context.",
    );
  }
  if (evidence.userPromptSha256 !== input.userPromptSha256) {
    fail(
      "USER_PROMPT_MISMATCH",
      "userPromptSha256",
      "Evidence does not identify the exact host prompt.",
    );
  }
  if (
    evidence.artifacts.length === 0 ||
    evidence.commands.length === 0 ||
    evidence.timings.length === 0
  ) {
    fail(
      "EVIDENCE_INCOMPLETE",
      "evidence",
      "Artifacts, commands, and timings must all be recorded.",
    );
  }
  const allowed = new Set(interventionBudget[input.scenarioId]);
  const kinds = new Set<string>();
  for (const [index, intervention] of evidence.interventions.entries()) {
    if (!allowed.has(intervention.kind) || kinds.has(intervention.kind)) {
      fail(
        "INTERVENTION_BUDGET_EXCEEDED",
        `interventions.${String(index)}`,
        "Only one declared consequential intervention of each scenario-approved kind is allowed.",
      );
    }
    kinds.add(intervention.kind);
  }
  for (const [index, timing] of evidence.timings.entries()) {
    const elapsed =
      Date.parse(timing.completedAt) - Date.parse(timing.startedAt);
    if (elapsed < 0 || Math.abs(elapsed - timing.durationMs) > 1) {
      fail(
        "TIMING_INVALID",
        `timings.${String(index)}`,
        "Timing is non-monotonic or inconsistent with durationMs.",
      );
    }
  }
  failures.push(
    ...assertNoForbiddenActions(evidence.forbiddenActions).failures,
  );
  for (const path of findLeakage(evidence)) {
    fail(
      "EVIDENCE_LEAKAGE",
      path,
      "Evidence contains a secret-shaped value or absolute filesystem path.",
    );
  }
  failures.push(...(input.verifierFailures ?? []));
  return {
    scenarioId: input.scenarioId,
    status: failures.length === 0 ? "passed" : "failed",
    failures: failures.sort((left, right) =>
      `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`),
    ),
  };
}

function findLeakage(value: unknown, path = "evidence"): string[] {
  if (typeof value === "string") {
    const secret =
      /(?:bearer\s+\S+|\b(?:sk-|xox[baprs]-)[A-Za-z0-9_-]{8,}|\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)=\S+)/iu;
    const absolutePath =
      /(?:^|[\s"'])(?:\/(?:Users|home|data|tmp|private|var)\/|[A-Za-z]:\\)/u;
    return secret.test(value) || absolutePath.test(value) ? [path] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findLeakage(entry, `${path}.${String(index)}`),
    );
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    findLeakage(entry, `${path}.${key}`),
  );
}
import { createHash } from "node:crypto";
