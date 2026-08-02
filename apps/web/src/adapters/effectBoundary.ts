import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import {
  normalizeMutationSuccess,
  type TemplateMutationState,
  type TemplateReadyMode,
} from "./confect-state";

export type FrontendEffectBoundaryResult<Value, TypedError> =
  TemplateMutationState<Value, TypedError>;

const abortedState = (): TemplateMutationState<never, never> => ({
  status: "transport_failure",
  error: new Error("Action aborted."),
  message: "Action aborted.",
});

const abortStateFor = (
  signal: AbortSignal | undefined,
): TemplateMutationState<never, never> | undefined =>
  signal?.aborted === true ? abortedState() : undefined;

const normalizeEffectResult = <Value, TypedError>(
  result: Result.Result<Value, TypedError>,
  mode: TemplateReadyMode | undefined,
): FrontendEffectBoundaryResult<Value, TypedError> =>
  Result.isFailure(result)
    ? { status: "typed_failure", error: result.failure }
    : normalizeMutationSuccess(
        result.success,
        mode === undefined ? {} : { mode },
      );

const defectState = <TypedError>(
  error: unknown,
): TemplateMutationState<never, TypedError> => ({
  status: "defect",
  error,
  message: error instanceof Error ? error.message : String(error),
});

type EffectCompletion<Value, TypedError> =
  | {
      readonly status: "completed";
      readonly result: Result.Result<Value, TypedError>;
    }
  | {
      readonly status: "defected";
      readonly error: unknown;
    };

const captureEffectCompletion = async <Value, TypedError>(
  effect: Effect.Effect<Value, TypedError, never>,
  signal: AbortSignal | undefined,
): Promise<EffectCompletion<Value, TypedError>> => {
  try {
    const result = await Effect.runPromise(Effect.result(effect), { signal });

    return { status: "completed", result };
  } catch (error) {
    return { status: "defected", error };
  }
};

const normalizeEffectCompletion = <Value, TypedError>(
  completion: EffectCompletion<Value, TypedError>,
  mode: TemplateReadyMode | undefined,
): FrontendEffectBoundaryResult<Value, TypedError> =>
  completion.status === "completed"
    ? normalizeEffectResult(completion.result, mode)
    : defectState(completion.error);

export const runFrontendEffectBoundary = async <Value, TypedError>(
  effect: Effect.Effect<Value, TypedError, never>,
  options: {
    readonly signal?: AbortSignal;
    readonly mode?: TemplateReadyMode;
  } = {},
): Promise<FrontendEffectBoundaryResult<Value, TypedError>> => {
  let boundaryState:
    FrontendEffectBoundaryResult<Value, TypedError> | undefined = abortStateFor(
    options.signal,
  );

  if (boundaryState === undefined) {
    const completion = await captureEffectCompletion(effect, options.signal);
    boundaryState =
      abortStateFor(options.signal) ??
      normalizeEffectCompletion(completion, options.mode);
  }

  return boundaryState;
};
