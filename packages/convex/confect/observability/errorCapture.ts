import type { CapturedFailureKind } from "@maestro-template/observability";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { ActionCtx, MutationCtx } from "../_generated/services";
import {
  captureFailure,
  type CaptureFailureInput,
  type SchedulerCtx,
} from "./posthog";

export type CapturedError = {
  readonly tag: string;
  readonly message: string;
  readonly hash: string;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
};

const messageFromFailure = (value: unknown): string => {
  if (typeof value !== "object" || value === null) {
    return "Effect failed.";
  }

  const failure = value as {
    readonly message?: unknown;
    readonly reason?: unknown;
  };

  if (typeof failure.reason === "string" && failure.reason.length > 0) {
    return failure.reason;
  }

  if (typeof failure.message === "string" && failure.message.length > 0) {
    return failure.message;
  }

  return "Effect failed.";
};

export const errorFromCause = <E>(cause: Cause.Cause<E>): CapturedError => {
  const rendered = Cause.pretty(cause);
  const failure = Cause.findError(cause);

  if (Result.isSuccess(failure)) {
    const value = failure.success as {
      readonly _tag?: string;
    };

    return {
      tag: value._tag ?? "EffectFailure",
      message: messageFromFailure(failure.success),
      hash: `cause_${Math.abs(hashString(rendered))}`,
    };
  }

  return {
    tag: "EffectDefect",
    message: "Effect failed with a defect.",
    hash: `cause_${Math.abs(hashString(rendered))}`,
  };
};

const captureAndRefailCause = <E>(
  ctx: SchedulerCtx,
  functionPath: string,
  kind: CapturedFailureKind,
  cause: Cause.Cause<E>,
): Effect.Effect<never, E> => {
  const error = errorFromCause(cause);
  const input: CaptureFailureInput = {
    functionPath,
    kind,
    errorTag: error.tag,
    errorMessage: error.message,
    causeHash: error.hash,
  };

  return captureFailure(ctx, input).pipe(
    Effect.catch(() => Effect.void),
    Effect.andThen(Effect.failCause(cause)),
  );
};

export const withMutationErrorCapture = <A, E, R>(
  functionPath: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | MutationCtx> =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    return yield* effect.pipe(
      Effect.catchCause((cause) =>
        captureAndRefailCause(ctx, functionPath, "mutation", cause),
      ),
    );
  });

export const withActionErrorCapture = <A, E, R>(
  functionPath: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | ActionCtx> =>
  Effect.gen(function* () {
    const ctx = yield* ActionCtx;
    return yield* effect.pipe(
      Effect.catchCause((cause) =>
        captureAndRefailCause(ctx, functionPath, "action", cause),
      ),
    );
  });
