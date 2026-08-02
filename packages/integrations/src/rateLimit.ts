import * as Schema from "effect/Schema";

export type RateLimitedOperation =
  "llm.complete" | "workflow.run" | "capability.run" | "api.request";

export type RateLimitUsageAttribution = {
  readonly workspaceSlug: string;
  readonly operation: RateLimitedOperation;
  readonly costUnits: number;
};

export type RateLimitCheckInput = RateLimitUsageAttribution & {
  readonly key: string;
};

export type RateLimitAllowed = {
  readonly ok: true;
  readonly key: string;
  readonly remaining: number;
  readonly resetAt: number;
  readonly usage: RateLimitUsageAttribution;
};

export class RateLimitDeniedError extends Schema.TaggedErrorClass<RateLimitDeniedError>()(
  "RateLimitDeniedError",
  {
    key: Schema.String,
    limit: Schema.Number,
    retryAfterMs: Schema.Number,
  },
) {}

export type RateLimitDenied = {
  readonly ok: false;
  readonly error: RateLimitDeniedError;
};

export type RateLimitResult = RateLimitAllowed | RateLimitDenied;

export type RateLimiter = {
  readonly check: (input: RateLimitCheckInput) => RateLimitResult;
};

export type ConvexRateLimiterAdapter = {
  readonly check: (input: RateLimitCheckInput) => Promise<
    | {
        readonly ok: true;
        readonly remaining: number;
        readonly resetAt: number;
      }
    | {
        readonly ok: false;
        readonly limit: number;
        readonly retryAfterMs: number;
      }
  >;
};

type BucketState = {
  readonly count: number;
  readonly resetAt: number;
};

export const workspaceLimiterKey = (input: {
  readonly workspaceSlug: string;
  readonly operation: RateLimitedOperation;
}): string => `workspace:${input.workspaceSlug}:operation:${input.operation}`;

export const tokenLimiterKey = (input: {
  readonly workspaceSlug: string;
  readonly tokenHash: string;
  readonly operation: RateLimitedOperation;
}): string =>
  `workspace:${input.workspaceSlug}:token:${input.tokenHash}:operation:${input.operation}`;

export const mapRateLimitError = (input: {
  readonly key: string;
  readonly limit: number;
  readonly retryAfterMs: number;
  readonly raw?: unknown;
}): RateLimitDeniedError =>
  new RateLimitDeniedError({
    key: input.key,
    limit: input.limit,
    retryAfterMs: input.retryAfterMs,
  });

export const createFakeRateLimiter = (options: {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly nowMs: () => number;
}): RateLimiter => {
  const buckets = new Map<string, BucketState>();

  return {
    check: (input) => {
      const nowMs = options.nowMs();
      const existing = buckets.get(input.key);
      const activeBucket =
        existing && existing.resetAt > nowMs
          ? existing
          : { count: 0, resetAt: nowMs + options.windowMs };

      if (activeBucket.count + input.costUnits > options.maxRequests) {
        return {
          ok: false,
          error: mapRateLimitError({
            key: input.key,
            limit: options.maxRequests,
            retryAfterMs: Math.max(0, activeBucket.resetAt - nowMs),
          }),
        };
      }

      const nextCount = activeBucket.count + input.costUnits;

      buckets.set(input.key, {
        count: nextCount,
        resetAt: activeBucket.resetAt,
      });

      return {
        ok: true,
        key: input.key,
        remaining: Math.max(0, options.maxRequests - nextCount),
        resetAt: activeBucket.resetAt,
        usage: {
          workspaceSlug: input.workspaceSlug,
          operation: input.operation,
          costUnits: input.costUnits,
        },
      };
    },
  };
};
