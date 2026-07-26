import type { AdoptionExecutionResult } from "./adoptExecution.js";
import {
  checksum,
  digest,
  exactPaths,
  parsePlan,
  receiptShape,
  sameStrings,
  type AdoptionReceiptFinding,
  type AdoptionReceiptVerification,
} from "./adoptReceipt.js";

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            )
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

export const verifyAdoptionReceipt = (input: {
  readonly executionPlan: NonNullable<AdoptionExecutionResult["artifact"]>;
  readonly reviewedExecutionPlanDigest: string;
  readonly authorityFingerprint: string;
  readonly receipt: unknown;
}): AdoptionReceiptVerification => {
  const findings: AdoptionReceiptFinding[] = [];
  const planDigest = digest(input.executionPlan.content);
  const plan = parsePlan(input.executionPlan.content);
  if (
    !checksum(input.reviewedExecutionPlanDigest) ||
    input.executionPlan.digest !== input.reviewedExecutionPlanDigest ||
    planDigest !== input.reviewedExecutionPlanDigest ||
    plan === null
  )
    findings.push({
      code: "ADOPTION_RECEIPT_PLAN_INVALID",
      message: "The execution plan bytes do not match the reviewed digest.",
      repair: "Supply the exact reviewed execution-plan artifact and digest.",
    });
  if (!receiptShape(input.receipt))
    findings.push({
      code: "ADOPTION_RECEIPT_SCHEMA_INVALID",
      message:
        "The adoption receipt does not match the closed receipt contract.",
      repair: "Supply every required phase and rollback field with no extras.",
    });
  if (plan === null || !receiptShape(input.receipt))
    return {
      ok: false,
      mutationPosture: "read-only",
      findings,
      receiptDigest: null,
    };
  const receipt = input.receipt;
  if (
    plan.authorityFingerprint !== input.authorityFingerprint ||
    receipt.authorityFingerprint !== input.authorityFingerprint ||
    receipt.executionPlanDigest !== input.reviewedExecutionPlanDigest
  )
    findings.push({
      code: "ADOPTION_RECEIPT_AUTHORITY_MISMATCH",
      message:
        "The receipt is not bound to the reviewed plan and launch authority.",
      repair:
        "Verify only a receipt carrying the exact plan digest and authority fingerprint.",
    });
  if (
    !exactPaths(plan.stage, receipt.phases.staged) ||
    receipt.phases.staged.some((item) => {
      const operation = plan.stage.find(({ path }) => path === item.path);
      return (
        operation?.stagedChecksum !== item.expectedChecksum ||
        item.expectedChecksum !== item.observedChecksum
      );
    })
  )
    findings.push({
      code: "ADOPTION_RECEIPT_STAGE_INVALID",
      message:
        "Staged evidence is incomplete or its bytes differ from the plan.",
      repair:
        "Record exactly one matching staged-byte observation per stage operation.",
    });
  if (
    !exactPaths(plan.verify, receipt.phases.verified) ||
    receipt.phases.verified.some((item) => {
      const operation = plan.verify.find(({ path }) => path === item.path);
      return (
        operation === undefined ||
        operation.sourceChecksum !== item.sourceChecksum ||
        item.sourceChecksum !== item.observedSourceChecksum ||
        operation.stagedChecksum !== item.targetChecksum ||
        item.targetChecksum !== item.observedTargetChecksum
      );
    })
  )
    findings.push({
      code: "ADOPTION_RECEIPT_VERIFY_INVALID",
      message:
        "Verification evidence is incomplete or differs from planned bytes.",
      repair:
        "Record exact source and target observations for every verification operation.",
    });
  const readinessPaths = receipt.phases.cutover.readinessEvidence.map(
    ({ path }) => path,
  );
  if (
    !sameStrings(plan.cutover.steps, receipt.phases.cutover.completedSteps) ||
    new Set(readinessPaths).size !== readinessPaths.length ||
    !sameStrings(plan.cutover.readinessEvidence, readinessPaths)
  )
    findings.push({
      code: "ADOPTION_RECEIPT_CUTOVER_INVALID",
      message:
        "Cutover steps or readiness evidence differ from the execution plan.",
      repair:
        "Complete the exact ordered cutover steps and readiness evidence set.",
    });
  if (
    !exactPaths(plan.deletions, receipt.phases.postCutoverDeletion) ||
    receipt.phases.postCutoverDeletion.some(
      (item) =>
        plan.deletions.find(({ path }) => path === item.path)
          ?.rollbackChecksum !== item.rollbackChecksum,
    )
  )
    findings.push({
      code: "ADOPTION_RECEIPT_DELETION_INVALID",
      message:
        "Post-cutover deletion evidence is incomplete or not rollback-bound.",
      repair:
        "Confirm only exact planned deletions with their rollback checksums.",
    });
  if (
    receipt.rollback.strategy !== plan.rollback.strategy ||
    receipt.rollback.evidencePath !== plan.rollback.evidence ||
    receipt.rollback.restoresSource !== plan.rollback.restoresSource ||
    (receipt.outcome === "rolled-back" &&
      receipt.rollback.status !== "exercised")
  )
    findings.push({
      code: "ADOPTION_RECEIPT_ROLLBACK_INVALID",
      message: "Rollback posture does not match the plan or recorded outcome.",
      repair:
        "Bind rollback strategy and evidence to the plan; rolled-back outcomes must be exercised.",
    });
  const content = `${JSON.stringify(canonical(input.receipt))}\n`;
  return {
    ok: findings.length === 0,
    mutationPosture: "read-only",
    findings,
    receiptDigest: findings.length === 0 ? digest(content) : null,
  };
};
