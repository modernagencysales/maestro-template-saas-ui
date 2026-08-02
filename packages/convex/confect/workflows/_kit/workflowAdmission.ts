import * as Schema from "effect/Schema";

export const WorkflowAdmissionLane = Schema.Literals(["user", "system"]);
export type WorkflowAdmissionLane = Schema.Schema.Type<
  typeof WorkflowAdmissionLane
>;

export type WorkflowAdmissionBudget = {
  readonly maxActive: number;
  readonly maxQueued: number;
  readonly retryAfterMs: number;
};
export type WorkflowAdmissionPolicy = Readonly<
  Record<WorkflowAdmissionLane, WorkflowAdmissionBudget>
>;
export type WorkflowAdmissionSnapshot = {
  readonly active: number;
  readonly queued: number;
};
export type WorkflowAdmissionDecision =
  | { readonly kind: "admit"; readonly lane: WorkflowAdmissionLane }
  | {
      readonly kind: "deny";
      readonly lane: WorkflowAdmissionLane;
      readonly saturated: "active" | "queued";
      readonly active: number;
      readonly queued: number;
      readonly limit: number;
      readonly retryAfterMs: number;
    };

export class WorkflowAdmissionDenied extends Schema.TaggedErrorClass<WorkflowAdmissionDenied>()(
  "WorkflowAdmissionDenied",
  {
    lane: WorkflowAdmissionLane,
    saturated: Schema.Literals(["active", "queued"]),
    active: Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
    queued: Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
    limit: Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
    retryAfterMs: Schema.Number.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0)),
    ),
  },
) {}

/**
 * Admission is distinct from Workpool execution parallelism. User work gets a
 * workspace-local lane; system work gets a smaller independent lane and can
 * never borrow idle user capacity.
 */
export const workflowAdmissionPolicy = (
  workpoolParallelism: number,
): WorkflowAdmissionPolicy => {
  if (!Number.isInteger(workpoolParallelism) || workpoolParallelism <= 0) {
    throw new Error("workpoolParallelism must be a positive integer");
  }
  const systemActive = Math.max(1, Math.floor(workpoolParallelism / 4));
  return {
    user: {
      maxActive: workpoolParallelism,
      maxQueued: workpoolParallelism * 4,
      retryAfterMs: 5_000,
    },
    system: {
      maxActive: systemActive,
      maxQueued: systemActive * 2,
      retryAfterMs: 30_000,
    },
  };
};

export const decideWorkflowAdmission = (
  lane: WorkflowAdmissionLane,
  snapshot: WorkflowAdmissionSnapshot,
  policy: WorkflowAdmissionPolicy,
): WorkflowAdmissionDecision => {
  const budget = policy[lane];
  if (snapshot.active >= budget.maxActive) {
    return {
      kind: "deny",
      lane,
      saturated: "active",
      ...snapshot,
      limit: budget.maxActive,
      retryAfterMs: budget.retryAfterMs,
    };
  }
  if (snapshot.queued >= budget.maxQueued) {
    return {
      kind: "deny",
      lane,
      saturated: "queued",
      ...snapshot,
      limit: budget.maxQueued,
      retryAfterMs: budget.retryAfterMs,
    };
  }
  return { kind: "admit", lane };
};
