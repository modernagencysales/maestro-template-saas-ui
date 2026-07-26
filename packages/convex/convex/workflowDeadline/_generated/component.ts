/* eslint-disable */
/** Generated component API types. */
import type { FunctionReference } from "convex/server";

type ScheduleArgs = {
  workspaceId: string;
  workflowRunId: string;
  workflowId: string;
  workflowVersion: number;
  generation: number;
  scheduleKey: string;
  requestedAt: number;
  horizonMs: number;
  deadlineAt: number;
  runAt: number;
};

type ScheduleDocument = ScheduleArgs & {
  _id: string;
  _creationTime: number;
  state: "preparing" | "scheduled" | "timedOut" | "reconciled" | "noOp";
  workId?: string;
  actualStartedAt?: number;
  latenessMs?: number;
  expired?: boolean;
  expiredByMs?: number;
  noOpReason?:
    | "terminal-run"
    | "stale-generation"
    | "stale-schedule"
    | "deadline-not-reached";
};

export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    deadlines: {
      prepare: FunctionReference<
        "mutation",
        "internal",
        ScheduleArgs,
        {
          kind: "create" | "replace" | "replay";
          priorWorkId: string | null;
        },
        Name
      >;
      bind: FunctionReference<
        "mutation",
        "internal",
        { scheduleKey: string; requestedAt: number; workId: string },
        null,
        Name
      >;
      current: FunctionReference<
        "query",
        "internal",
        { workflowRunId: string; generation: number },
        ScheduleDocument | null,
        Name
      >;
      observe: FunctionReference<
        "mutation",
        "internal",
        {
          scheduleKey: string;
          requestedAt: number;
          state: "timedOut" | "noOp";
          actualStartedAt: number;
          latenessMs: number;
          expired: boolean;
          expiredByMs: number;
          noOpReason?:
            | "terminal-run"
            | "stale-generation"
            | "stale-schedule"
            | "deadline-not-reached";
        },
        boolean,
        Name
      >;
      beginReconcile: FunctionReference<
        "query",
        "internal",
        { workflowRunId: string; generation: number },
        string | null,
        Name
      >;
      completeReconcile: FunctionReference<
        "mutation",
        "internal",
        { workflowRunId: string; generation: number; workId: string },
        boolean,
        Name
      >;
    };
  };
