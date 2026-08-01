import { Workpool } from "@convex-dev/workpool";
import * as Effect from "effect/Effect";
import { makeFunctionReference, type FunctionReference } from "convex/server";

import { MutationCtx } from "../_generated/services";
import { workpoolComponent } from "../jobs/componentRefs";
import { ValidationFailed } from "../errors";

const pool = new Workpool(workpoolComponent, {
  maxParallelism: 3,
  retryActionsByDefault: false,
});

const runPackRef = makeFunctionReference<
  "action",
  { readonly packId: string },
  unknown
>("buildPacks/packs:runPack") as unknown as FunctionReference<
  "action",
  "internal",
  { readonly packId: string },
  unknown
>;

export const enqueueBuildPackRunWith = (
  enqueue: (packId: string) => Promise<unknown>,
  packId: string,
) =>
  Effect.tryPromise({
    try: () => enqueue(packId),
    catch: () =>
      new ValidationFailed({
        field: "packId",
        message: "The Build Pack could not be queued.",
      }),
  });

export const enqueueBuildPackRun = (packId: string) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    yield* enqueueBuildPackRunWith(
      (queuedPackId) =>
        pool.enqueueAction(
          ctx,
          runPackRef,
          { packId: queuedPackId },
          { retry: false },
        ),
      packId,
    );
  });
