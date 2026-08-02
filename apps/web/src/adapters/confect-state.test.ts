import { describe, expect, expectTypeOf, it } from "vitest";
import { QueryResult } from "@confect/react";
import * as Result from "effect/Result";
import {
  classifyConfectMutationResult,
  isTemplateFailureState,
  normalizeConfectQuery,
  normalizeMutationError,
  normalizeMutationPending,
  normalizeMutationSuccess,
  notifyTemplateMutation,
  TEMPLATE_DATA_STATUSES,
  TEMPLATE_MUTATION_STATUSES,
  toastForTemplateMutation,
  type TemplateDataState,
  type TemplateMutationState,
} from "./confect-state";
import { normalizeReactQueryResult } from "./react-query-state";

type TypedError = {
  readonly _tag: "ValidationFailed";
  readonly message: string;
};

describe("Confect React data-state adapter", () => {
  it("exposes one canonical frontend state vocabulary", () => {
    expect(TEMPLATE_DATA_STATUSES).toEqual([
      "skipped",
      "loading",
      "empty",
      "ready",
      "typed_failure",
      "parse_failure",
      "transport_failure",
      "defect",
    ]);
    expect(TEMPLATE_MUTATION_STATUSES).toEqual([
      "loading",
      "ready",
      "typed_failure",
      "parse_failure",
      "transport_failure",
      "defect",
    ]);
    expect(
      isTemplateFailureState({
        status: "typed_failure",
        error: { _tag: "Unauthorized" },
      }),
    ).toBe(true);
    expect(
      isTemplateFailureState({
        status: "ready",
        mode: "read",
        data: { id: "ok" },
      }),
    ).toBe(false);
  });

  it("normalizes skipped, loading, empty, ready/read, and ready/edit query states", () => {
    expect(normalizeConfectQuery(QueryResult.load(true))).toEqual({
      status: "skipped",
    });
    expect(normalizeConfectQuery(QueryResult.load(false))).toEqual({
      status: "loading",
    });
    expect(normalizeConfectQuery(QueryResult.succeed([]))).toEqual({
      status: "empty",
      data: [],
    });
    expect(
      normalizeConfectQuery(QueryResult.succeed({ id: "source_1" })),
    ).toEqual({
      status: "ready",
      mode: "read",
      data: { id: "source_1" },
    });
    expect(
      normalizeConfectQuery(QueryResult.succeed({ id: "source_1" }), {
        mode: "edit",
      }),
    ).toMatchObject({
      status: "ready",
      mode: "edit",
    });
  });

  it("preserves typed Confect failures separately from transport and parse failures", () => {
    const error: TypedError = {
      _tag: "ValidationFailed",
      message: "Name is required",
    };

    expect(normalizeConfectQuery(QueryResult.fail(error))).toEqual({
      status: "typed_failure",
      error,
    });
    expect(normalizeMutationError(new TypeError("network down"))).toEqual({
      status: "transport_failure",
      error: expect.any(TypeError),
      message: "network down",
    });
    expect(normalizeMutationError(new SyntaxError("bad json"))).toEqual({
      status: "parse_failure",
      error: expect.any(SyntaxError),
      message: "bad json",
    });
    expect(normalizeMutationError("boom")).toEqual({
      status: "defect",
      error: "boom",
      message: "Unexpected client defect.",
    });
  });

  it("normalizes mutation pending, success, typed failure, and thrown failure states", () => {
    const error: TypedError = {
      _tag: "ValidationFailed",
      message: "Name is required",
    };

    expect(normalizeMutationPending()).toEqual({ status: "loading" });
    expect(normalizeMutationSuccess({ id: "receipt_1" })).toEqual({
      status: "ready",
      mode: "read",
      data: { id: "receipt_1" },
      mutation: "success",
    });
    expect(classifyConfectMutationResult(Result.succeed("ok"))).toEqual({
      status: "ready",
      mode: "read",
      data: "ok",
      mutation: "success",
    });
    expect(classifyConfectMutationResult(Result.fail(error))).toEqual({
      status: "typed_failure",
      error,
    });
  });

  it("maps mutation results to accessible toast announcements", () => {
    const success = toastForTemplateMutation(
      normalizeMutationSuccess({ pageId: "page_1" }),
      {
        successTitle: "Page saved",
        successDescription: (data) => `Created ${data.pageId}.`,
        failureTitle: "Page save failed",
      },
    );
    const typedFailure = toastForTemplateMutation(
      {
        status: "typed_failure",
        error: {
          _tag: "ValidationFailed",
          message: "Title is required",
        },
      },
      {
        successTitle: "Page saved",
        failureTitle: "Page save failed",
      },
    );
    const loading = toastForTemplateMutation(normalizeMutationPending(), {
      successTitle: "Page saved",
      failureTitle: "Page save failed",
    });

    expect(success).toEqual({
      title: "Page saved",
      description: "Created page_1.",
      tone: "success",
      announcement: "Page saved",
    });
    expect(typedFailure).toEqual({
      title: "Page save failed",
      description: "Title is required",
      tone: "danger",
      announcement: {
        message: "Page save failed. Title is required",
        priority: "assertive",
      },
    });
    expect(loading).toBeNull();
  });

  it("notifies through the shared toast provider API for mutation failures", () => {
    const emitted: unknown[] = [];
    const toast = {
      announce: () => "unused",
      announceAssertive: () => "unused",
      dismiss: () => {},
      notify: (input: unknown) => {
        emitted.push(input);
        return "toast_1";
      },
    };

    expect(
      notifyTemplateMutation({
        toast,
        state: normalizeMutationError(new TypeError("network down")),
        copy: {
          successTitle: "Saved",
          failureTitle: "Save failed",
        },
      }),
    ).toBe("toast_1");
    expect(emitted).toEqual([
      {
        title: "Save failed",
        description: "network down",
        tone: "danger",
        announcement: {
          message: "Save failed. network down",
          priority: "assertive",
        },
      },
    ]);
  });

  it("normalizes Convex React Query style results without knowing business logic", () => {
    expect(normalizeReactQueryResult({ status: "pending" })).toEqual({
      status: "loading",
    });
    expect(
      normalizeReactQueryResult({ status: "success", data: null }),
    ).toEqual({
      status: "empty",
      data: null,
    });
    expect(
      normalizeReactQueryResult({ status: "error", error: new Error("boom") }),
    ).toEqual({
      status: "transport_failure",
      error: expect.any(Error),
      message: "boom",
    });
  });

  it("keeps typed result inference through the normalized state", () => {
    type State = TemplateDataState<{ readonly id: string }, TypedError>;
    type Mutation = TemplateMutationState<{ readonly id: string }, TypedError>;

    expectTypeOf<Extract<State, { status: "ready" }>["data"]>().toEqualTypeOf<{
      readonly id: string;
    }>();
    expectTypeOf<
      Extract<State, { status: "typed_failure" }>["error"]
    >().toEqualTypeOf<TypedError>();
    expectTypeOf<
      Extract<Mutation, { mutation: "success" }>["data"]
    >().toEqualTypeOf<{ readonly id: string }>();
  });

  it("keeps typed mutation result inference without importing backend source into the web project", () => {
    type GeneratedReturn = { readonly pageId: string };
    type GeneratedError = { readonly _tag: "ValidationFailed" };
    type MutationState = ReturnType<
      typeof classifyConfectMutationResult<GeneratedReturn, GeneratedError>
    >;

    expectTypeOf<
      Extract<MutationState, { mutation: "success" }>["data"]
    >().toEqualTypeOf<GeneratedReturn>();
    expectTypeOf<
      Extract<MutationState, { status: "typed_failure" }>["error"]
    >().toEqualTypeOf<GeneratedError>();
  });
});
