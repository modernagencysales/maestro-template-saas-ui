/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    deadlines: {
      beginReconcile: FunctionReference<
        "query",
        "internal",
        { generation: number; workflowRunId: string },
        any,
        Name
      >;
      bind: FunctionReference<
        "mutation",
        "internal",
        { requestedAt: number; scheduleKey: string; workId: string },
        any,
        Name
      >;
      completeReconcile: FunctionReference<
        "mutation",
        "internal",
        { generation: number; workId: string; workflowRunId: string },
        any,
        Name
      >;
      current: FunctionReference<
        "query",
        "internal",
        { generation: number; workflowRunId: string },
        any,
        Name
      >;
      observe: FunctionReference<
        "mutation",
        "internal",
        {
          actualStartedAt: number;
          expired: boolean;
          expiredByMs: number;
          latenessMs: number;
          noOpReason?:
            | "terminal-run"
            | "stale-generation"
            | "stale-schedule"
            | "deadline-not-reached";
          requestedAt: number;
          scheduleKey: string;
          state: "timedOut" | "noOp";
        },
        any,
        Name
      >;
      prepare: FunctionReference<
        "mutation",
        "internal",
        {
          deadlineAt: number;
          generation: number;
          horizonMs: number;
          requestedAt: number;
          runAt: number;
          scheduleKey: string;
          workflowId: string;
          workflowRunId: string;
          workflowVersion: number;
          workspaceId: string;
        },
        any,
        Name
      >;
      prepareRetry: FunctionReference<
        "mutation",
        "internal",
        {
          completedWorkId: string;
          failedAt: number;
          requestedAt: number;
          scheduleKey: string;
        },
        any,
        Name
      >;
    };
  };
