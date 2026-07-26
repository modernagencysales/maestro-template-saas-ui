/* eslint-disable */
/** Generated component API types. */
import type { FunctionReference } from "convex/server";

type Status =
  "queued" | "running" | "completed" | "failed" | "canceled" | "timedOut";
type Budget = { maxActive: number; maxQueued: number; retryAfterMs: number };

export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    admission: {
      reserve: FunctionReference<
        "mutation",
        "internal",
        {
          workspaceId: string;
          reservationKey: string;
          lane: "user" | "system";
          policy: { user: Budget; system: Budget };
          legacyRunningRunIds: string[];
          legacyQueuedRunIds: string[];
        },
        null,
        Name
      >;
      bind: FunctionReference<
        "mutation",
        "internal",
        { workspaceId: string; reservationKey: string; workflowRunId: string },
        null,
        Name
      >;
      transition: FunctionReference<
        "mutation",
        "internal",
        { workflowRunId: string; status: Status },
        null,
        Name
      >;
    };
  };
