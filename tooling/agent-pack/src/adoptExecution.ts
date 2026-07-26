import { createHash } from "node:crypto";
import {
  validateAdoptionAuthority,
  type AdoptionAuthorityInput,
  type AdoptionAuthorityResult,
} from "./adoptAuthority.js";
import {
  previewAdoptionWorkPackage,
  type AdoptionDisposition,
  type AdoptionWorkPackage,
} from "./adopt.js";

export type AdoptionExecutionIntent = {
  readonly path: string;
  readonly disposition: AdoptionDisposition;
  readonly sourceChecksum: string;
  readonly stagedChecksum: string | null;
  readonly rollbackChecksum: string | null;
};

export type AdoptionExecutionInput = {
  readonly workPackage: AdoptionWorkPackage;
  readonly authority: AdoptionAuthorityInput;
  readonly intents: readonly AdoptionExecutionIntent[];
};

export type AdoptionExecutionFinding = {
  readonly code: string;
  readonly message: string;
  readonly repair: string;
};

export type AdoptionExecutionResult = {
  readonly ok: boolean;
  readonly mutationPosture: "dry-run";
  readonly findings: readonly AdoptionExecutionFinding[];
  readonly artifact: {
    readonly path: string;
    readonly content: string;
    readonly digest: string;
  } | null;
};

type PlanOperation = AdoptionExecutionIntent & {
  readonly action:
    | "verify-preserved"
    | "stage-port"
    | "stage-replacement"
    | "delete-after-cutover";
};

const finding = (
  code: string,
  message: string,
  repair: string,
): AdoptionExecutionFinding => ({ code, message, repair });

const checksum = (value: string): boolean =>
  /^sha256:[a-f0-9]{64}$/.test(value);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const pathsOverlap = (left: string, right: string): boolean =>
  left === right ||
  left.startsWith(`${right}/`) ||
  right.startsWith(`${left}/`);

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => compareCodeUnits(left, right))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

const hash = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const actionFor = (
  disposition: AdoptionDisposition,
): PlanOperation["action"] => {
  if (disposition === "preserve") return "verify-preserved";
  if (disposition === "port") return "stage-port";
  if (disposition === "replace") return "stage-replacement";
  return "delete-after-cutover";
};

const validByteContract = (intent: AdoptionExecutionIntent): boolean => {
  if (!checksum(intent.sourceChecksum)) return false;
  if (intent.disposition === "preserve")
    return intent.stagedChecksum === null && intent.rollbackChecksum === null;
  if (intent.disposition === "port")
    return (
      intent.stagedChecksum !== null &&
      checksum(intent.stagedChecksum) &&
      intent.rollbackChecksum === null
    );
  if (intent.disposition === "replace")
    return (
      intent.stagedChecksum !== null &&
      checksum(intent.stagedChecksum) &&
      intent.rollbackChecksum !== null &&
      checksum(intent.rollbackChecksum)
    );
  return (
    intent.stagedChecksum === null &&
    intent.rollbackChecksum !== null &&
    checksum(intent.rollbackChecksum)
  );
};

const authorityMatchesWorkPackage = (
  workPackage: AdoptionWorkPackage,
  authorityInput: AdoptionAuthorityInput,
  authority: AdoptionAuthorityResult,
): boolean =>
  authority.ok &&
  authority.authorityFingerprint !== null &&
  workPackage.authority.fingerprint === authority.authorityFingerprint &&
  workPackage.mode === authorityInput.mode &&
  workPackage.sourceReadOnly === authorityInput.sourceReadOnly &&
  workPackage.roots.source === authorityInput.source.resolvedRoot &&
  workPackage.roots.target === authorityInput.target.resolvedRoot &&
  workPackage.roots.sourceWorktree === authorityInput.source.worktreeRoot &&
  workPackage.roots.targetWorktree === authorityInput.target.worktreeRoot &&
  workPackage.worktrees.source.exists === authorityInput.source.exists &&
  workPackage.worktrees.target.exists === authorityInput.target.exists &&
  workPackage.worktrees.source.clean === authorityInput.source.clean &&
  workPackage.worktrees.target.clean === authorityInput.target.clean &&
  workPackage.worktrees.source.revision === authorityInput.source.revision &&
  workPackage.worktrees.target.revision === authorityInput.target.revision &&
  workPackage.authority.template.tag === authorityInput.template.tag &&
  workPackage.authority.template.commit === authorityInput.template.commit &&
  workPackage.authority.template.archiveChecksum ===
    authorityInput.template.archiveChecksum &&
  workPackage.authority.template.manifestChecksum ===
    authorityInput.template.manifestChecksum;

export const compileAdoptionExecutionPlan = (
  input: AdoptionExecutionInput,
): AdoptionExecutionResult => {
  const findings: AdoptionExecutionFinding[] = [];
  const authority = validateAdoptionAuthority(input.authority);
  if (
    !authority.ok ||
    authority.authorityFingerprint === null ||
    !checksum(authority.authorityFingerprint)
  )
    findings.push(
      finding(
        "ADOPTION_EXECUTION_AUTHORITY_REQUIRED",
        "Execution planning lacks an accepted launch-authority fingerprint.",
        "Validate current source, target, worktree, and release facts before planning execution.",
      ),
    );
  else if (
    !authorityMatchesWorkPackage(input.workPackage, input.authority, authority)
  )
    findings.push(
      finding(
        "ADOPTION_EXECUTION_AUTHORITY_MISMATCH",
        "The work package does not match the recomputed launch authority.",
        "Rebuild and reapprove the package from the exact clean roots, revisions, and immutable template binding.",
      ),
    );

  const preview = previewAdoptionWorkPackage(input.workPackage);
  if (!preview.ok || preview.artifact === null)
    findings.push(
      finding(
        "ADOPTION_EXECUTION_WORK_PACKAGE_INVALID",
        "The adoption work package is not valid.",
        "Repair the closed work-package contract before compiling execution.",
      ),
    );
  if (
    input.workPackage.approval.status !== "approved" ||
    input.workPackage.approval.evidence === null
  )
    findings.push(
      finding(
        "ADOPTION_EXECUTION_APPROVAL_REQUIRED",
        "Execution planning requires explicit approval evidence.",
        "Record approval without inferring it from implementation state.",
      ),
    );

  const decisions = new Map(
    input.workPackage.decisions.map((decision) => [decision.path, decision]),
  );
  const intentPaths = input.intents.map(({ path }) => path);
  const uniqueIntentPaths = new Set(intentPaths);
  if (
    uniqueIntentPaths.size !== input.intents.length ||
    decisions.size !== input.intents.length ||
    [...decisions.keys()].some((path) => !uniqueIntentPaths.has(path)) ||
    intentPaths.some((path) => !decisions.has(path))
  )
    findings.push(
      finding(
        "ADOPTION_EXECUTION_COVERAGE_INVALID",
        "Execution intents do not cover each approved decision exactly once.",
        "Supply one and only one byte contract for every caller-approved path.",
      ),
    );
  if (
    input.intents.some((intent, index) =>
      input.intents.some(
        (candidate, candidateIndex) =>
          index !== candidateIndex && pathsOverlap(intent.path, candidate.path),
      ),
    )
  )
    findings.push(
      finding(
        "ADOPTION_EXECUTION_PATH_OVERLAP",
        "Execution intents contain ancestor/descendant path collisions.",
        "Compile only disjoint exact paths from the approved work package.",
      ),
    );
  if (
    input.intents.some(
      (intent) =>
        decisions.get(intent.path)?.disposition !== intent.disposition,
    )
  )
    findings.push(
      finding(
        "ADOPTION_EXECUTION_DECISION_DRIFT",
        "An execution intent changes a caller-approved disposition.",
        "Preserve the exact preserve, port, replace, or delete decision.",
      ),
    );
  if (input.intents.some((intent) => !validByteContract(intent)))
    findings.push(
      finding(
        "ADOPTION_EXECUTION_BYTES_INVALID",
        "An execution intent lacks the exact bytes required by its disposition.",
        "Bind source, staged, and rollback checksums according to the reviewed disposition.",
      ),
    );

  if (findings.length > 0 || preview.artifact === null)
    return {
      ok: false,
      mutationPosture: "dry-run",
      findings,
      artifact: null,
    };

  const operations = input.intents
    .map((intent): PlanOperation => ({
      ...intent,
      action: actionFor(intent.disposition),
    }))
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  const stage = operations.filter(({ disposition }) =>
    ["port", "replace"].includes(disposition),
  );
  const verify = operations.filter(
    ({ disposition }) => disposition !== "delete",
  );
  const postCutover = operations.filter(
    ({ disposition }) => disposition === "delete",
  );
  const plan = {
    schemaVersion: 1,
    id: `${input.workPackage.id}-execution`,
    authorityFingerprint: authority.authorityFingerprint,
    workPackageDigest: hash(preview.artifact.content),
    sourceReadOnlyDuringExecution: true,
    phases: [
      { name: "stage", operations: stage },
      { name: "verify", operations: verify },
      {
        name: "cutover",
        strategy: input.workPackage.cutover.strategy,
        steps: input.workPackage.cutover.steps,
        readinessEvidence: input.workPackage.cutover.readinessEvidence,
        operations: [],
      },
      {
        name: "post-cutover-deletion",
        operations: postCutover,
      },
    ],
    rollback: input.workPackage.rollback,
    approvalEvidence: input.workPackage.approval.evidence,
  };
  const content = `${JSON.stringify(canonical(plan), null, 2)}\n`;
  return {
    ok: true,
    mutationPosture: "dry-run",
    findings: [],
    artifact: {
      path: `adoption/${input.workPackage.id}.execution-plan.json`,
      content,
      digest: hash(content),
    },
  };
};
