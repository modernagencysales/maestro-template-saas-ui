import { expect } from "vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";

export const expectEffectSuccess = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  provide: (effect: Effect.Effect<A, E, R>) => Effect.Effect<A>,
): Promise<A> => {
  const exit = await Effect.runPromiseExit(provide(effect));
  if (Exit.isFailure(exit)) {
    throw new Error(
      `Expected Effect success, received failure: ${String(exit.cause)}`,
    );
  }
  return exit.value;
};

export const expectTaggedFailure = async <
  A,
  E extends { readonly _tag: string },
  R,
>(
  effect: Effect.Effect<A, E, R>,
  provide: (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E>,
  expectedTag: E["_tag"],
): Promise<E> => {
  const exit = await Effect.runPromiseExit(provide(effect));
  if (Exit.isSuccess(exit)) {
    throw new Error(`Expected Effect failure ${expectedTag}, received success`);
  }
  const failure = Cause.findError(exit.cause);
  if (Result.isFailure(failure)) {
    throw new Error(
      `Expected typed Effect failure ${expectedTag}, received defect or interruption`,
    );
  }
  const captured = failure.success;
  expect(captured._tag).toBe(expectedTag);
  return captured;
};
