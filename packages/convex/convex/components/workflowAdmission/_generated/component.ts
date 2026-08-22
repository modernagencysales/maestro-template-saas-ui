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
    admission: {
      bind: FunctionReference<
        "mutation",
        "internal",
        { reservationKey: string; workflowRunId: string; workspaceId: string },
        any,
        Name
      >;
      reserve: FunctionReference<
        "mutation",
        "internal",
        {
          lane: "user" | "system";
          legacyQueuedRunIds: Array<string>;
          legacyRunningRunIds: Array<string>;
          policy: {
            system: {
              maxActive: number;
              maxQueued: number;
              retryAfterMs: number;
            };
            user: {
              maxActive: number;
              maxQueued: number;
              retryAfterMs: number;
            };
          };
          reservationKey: string;
          workspaceId: string;
        },
        any,
        Name
      >;
      transition: FunctionReference<
        "mutation",
        "internal",
        {
          status:
            | "queued"
            | "running"
            | "completed"
            | "failed"
            | "canceled"
            | "timedOut";
          workflowRunId: string;
        },
        any,
        Name
      >;
    };
  };
