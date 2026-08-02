import {
  QueryResult,
  useAction as useConfectAction,
  useMutation as useConfectMutation,
  useQuery as useConfectQuery,
  type ReactMutation,
} from "@confect/react";
import type { Ref } from "@confect/core";
import type {
  TemplateToastApi,
  TemplateToastInput,
} from "@maestro-template/ui";
import * as Result from "effect/Result";

export type TemplateReadyMode = "read" | "edit";

export type TemplateSkippedState = {
  readonly status: "skipped";
};

export type TemplateLoadingState = {
  readonly status: "loading";
};

export type TemplateEmptyState<T> = {
  readonly status: "empty";
  readonly data: T;
};

export type TemplateReadyState<T> = {
  readonly status: "ready";
  readonly mode: TemplateReadyMode;
  readonly data: T;
};

export type TemplateMutationSuccessState<T> = TemplateReadyState<T> & {
  readonly mutation: "success";
};

export type TemplateTypedFailureState<E> = {
  readonly status: "typed_failure";
  readonly error: E;
};

export type TemplateParseFailureState = {
  readonly status: "parse_failure";
  readonly error: unknown;
  readonly message: string;
};

export type TemplateTransportFailureState = {
  readonly status: "transport_failure";
  readonly error: unknown;
  readonly message: string;
};

export type TemplateDefectState = {
  readonly status: "defect";
  readonly error: unknown;
  readonly message: string;
};

export type TemplateDataState<T, E = never> =
  | TemplateSkippedState
  | TemplateLoadingState
  | TemplateEmptyState<T>
  | TemplateReadyState<T>
  | TemplateTypedFailureState<E>
  | TemplateParseFailureState
  | TemplateTransportFailureState
  | TemplateDefectState;

export type TemplateMutationState<T, E = never> =
  | TemplateLoadingState
  | TemplateMutationSuccessState<T>
  | TemplateTypedFailureState<E>
  | TemplateParseFailureState
  | TemplateTransportFailureState
  | TemplateDefectState;

export type TemplateDataStatus = TemplateDataState<unknown, unknown>["status"];
export type TemplateMutationStatus = TemplateMutationState<
  unknown,
  unknown
>["status"];

export const TEMPLATE_DATA_STATUSES = [
  "skipped",
  "loading",
  "empty",
  "ready",
  "typed_failure",
  "parse_failure",
  "transport_failure",
  "defect",
] as const satisfies readonly TemplateDataStatus[];

export const TEMPLATE_MUTATION_STATUSES = [
  "loading",
  "ready",
  "typed_failure",
  "parse_failure",
  "transport_failure",
  "defect",
] as const satisfies readonly TemplateMutationStatus[];

export type TemplateFailureState<E = unknown> =
  | TemplateTypedFailureState<E>
  | TemplateParseFailureState
  | TemplateTransportFailureState
  | TemplateDefectState;

export type TemplateMutationToastCopy<T, E = unknown> = {
  readonly successTitle: string;
  readonly successDescription?: (data: T) => string;
  readonly failureTitle: string;
  readonly failureDescription?: (failure: TemplateFailureState<E>) => string;
};

export function isTemplateFailureState<E>(
  state: TemplateDataState<unknown, E> | TemplateMutationState<unknown, E>,
): state is TemplateFailureState<E> {
  return (
    state.status === "typed_failure" ||
    state.status === "parse_failure" ||
    state.status === "transport_failure" ||
    state.status === "defect"
  );
}

export type NormalizeOptions<T> = {
  readonly mode?: TemplateReadyMode;
  readonly isEmpty?: (value: T) => boolean;
};

export function normalizeConfectQuery<T, E>(
  result: QueryResult.QueryResult<T, E>,
  options: NormalizeOptions<T> = {},
): TemplateDataState<T, E> {
  if (QueryResult.isLoading(result)) {
    return result.skipped ? { status: "skipped" } : { status: "loading" };
  }

  if (QueryResult.isFailure(result)) {
    return { status: "typed_failure", error: result.error };
  }

  return readyOrEmpty(result.value, options);
}

export function normalizeMutationPending(): TemplateMutationState<
  never,
  never
> {
  return { status: "loading" };
}

export function normalizeMutationSuccess<T>(
  data: T,
  options: Pick<NormalizeOptions<T>, "mode"> = {},
): TemplateMutationSuccessState<T> {
  return {
    status: "ready",
    mode: options.mode ?? "read",
    data,
    mutation: "success",
  };
}

export function classifyConfectMutationResult<T, E>(
  result: Result.Result<T, E> | T,
  options: Pick<NormalizeOptions<T>, "mode"> = {},
): TemplateMutationState<T, E> {
  if (Result.isResult(result)) {
    return Result.isFailure(result)
      ? { status: "typed_failure", error: result.failure }
      : normalizeMutationSuccess(result.success, options);
  }

  return normalizeMutationSuccess(result, options);
}

export function normalizeMutationError(
  error: unknown,
):
  | TemplateParseFailureState
  | TemplateTransportFailureState
  | TemplateDefectState {
  return classifyUnknownFailure(error);
}

export function useTemplateQuery<Query extends Ref.AnyPublicQuery>(
  ref: Query,
  args: Ref.Args<Query> | "skip",
  options?: NormalizeOptions<Ref.Returns<Query>>,
): TemplateDataState<Ref.Returns<Query>, Ref.Error<Query>> {
  return normalizeConfectQuery(useConfectQuery(ref, args), options);
}

export function useTemplateMutation<Mutation extends Ref.AnyPublicMutation>(
  ref: Mutation,
): ReactMutation<Mutation> {
  return useConfectMutation(ref);
}

export const useTemplateAction = <Action extends Ref.AnyPublicAction>(
  ref: Action,
) => useConfectAction(ref);

export function readyOrEmpty<T>(
  data: T,
  options: NormalizeOptions<T>,
): TemplateEmptyState<T> | TemplateReadyState<T> {
  if ((options.isEmpty ?? defaultIsEmpty)(data)) {
    return { status: "empty", data };
  }

  return {
    status: "ready",
    mode: options.mode ?? "read",
    data,
  };
}

function defaultIsEmpty(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

export function classifyUnknownFailure(
  error: unknown,
):
  | TemplateParseFailureState
  | TemplateTransportFailureState
  | TemplateDefectState {
  if (error instanceof SyntaxError) {
    return {
      status: "parse_failure",
      error,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      status: error instanceof TypeError ? "transport_failure" : "defect",
      error,
      message: error.message,
    };
  }

  return {
    status: "defect",
    error,
    message: "Unexpected client defect.",
  };
}

export function toastForTemplateMutation<T, E>(
  state: TemplateMutationState<T, E>,
  copy: TemplateMutationToastCopy<T, E>,
): TemplateToastInput | null {
  if (state.status === "ready" && state.mutation === "success") {
    return {
      title: copy.successTitle,
      tone: "success",
      announcement: copy.successTitle,
      ...(copy.successDescription
        ? { description: copy.successDescription(state.data) }
        : {}),
    };
  }

  if (isTemplateFailureState(state)) {
    const description =
      copy.failureDescription?.(state) ?? defaultMutationFailureMessage(state);

    return {
      title: copy.failureTitle,
      description,
      tone: "danger",
      announcement: {
        message: `${copy.failureTitle}. ${description}`,
        priority: "assertive",
      },
    };
  }

  return null;
}

export function notifyTemplateMutation<T, E>({
  copy,
  state,
  toast,
}: {
  readonly copy: TemplateMutationToastCopy<T, E>;
  readonly state: TemplateMutationState<T, E>;
  readonly toast: TemplateToastApi;
}): string | null {
  const notification = toastForTemplateMutation(state, copy);

  return notification ? toast.notify(notification) : null;
}

function defaultMutationFailureMessage(
  failure: TemplateFailureState<unknown>,
): string {
  if (failure.status === "typed_failure") {
    const maybeMessage =
      typeof failure.error === "object" &&
      failure.error !== null &&
      "message" in failure.error
        ? failure.error.message
        : undefined;

    return typeof maybeMessage === "string"
      ? maybeMessage
      : "The request was rejected by the server.";
  }

  return failure.message;
}
