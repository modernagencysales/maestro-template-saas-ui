import type { Ref } from "@confect/core";
import type { InvokeReturn, ReactMutation } from "@confect/react";
import type { TemplateConfectRefs } from "@maestro-template/convex/refs";
import { describe, expectTypeOf, it } from "vitest";
import {
  type TemplateDataState,
  type TemplateMutationState,
  useTemplateAction,
  useTemplateMutation,
  useTemplateQuery,
} from "./confect-state";

type BrainPageListRef = TemplateConfectRefs["public"]["brain"]["pages"]["list"];
type BrainPageCreateRef =
  TemplateConfectRefs["public"]["brain"]["pages"]["createMarkdown"];
type EvaluateAppIdeaWithModelRef =
  TemplateConfectRefs["public"]["capabilities"]["evaluateAppIdea"]["evaluateAppIdeaWithModel"];
type TemplateQueryResult<Query extends Ref.AnyPublicQuery> = ReturnType<
  typeof useTemplateQuery<Query>
>;
type TemplateMutationResult<Mutation extends Ref.AnyPublicMutation> =
  ReturnType<typeof useTemplateMutation<Mutation>>;
type TemplateActionResult<Action extends Ref.AnyPublicAction> = ReturnType<
  typeof useTemplateAction<Action>
>;
type WorkspaceNotFoundVariant<Error> = Extract<
  Error,
  { readonly _tag: "WorkspaceNotFound" }
>;

describe("generated Confect refs through the web adapter", () => {
  it("infers generated query args, returns, and typed failures", () => {
    expectTypeOf<BrainPageListRef>().toMatchTypeOf<Ref.AnyPublicQuery>();
    expectTypeOf<Ref.Args<BrainPageListRef>>().toHaveProperty("workspaceId");
    expectTypeOf<Ref.Returns<BrainPageListRef>>().toMatchTypeOf<
      ReadonlyArray<{ readonly workspaceId: string; readonly title: string }>
    >();
    expectTypeOf<WorkspaceNotFoundVariant<Ref.Error<BrainPageListRef>>>()
      .toHaveProperty("workspaceId")
      .toEqualTypeOf<string>();

    expectTypeOf<TemplateQueryResult<BrainPageListRef>>().toEqualTypeOf<
      TemplateDataState<
        Ref.Returns<BrainPageListRef>,
        Ref.Error<BrainPageListRef>
      >
    >();
  });

  it("infers generated mutation args, results, and typed failures", () => {
    expectTypeOf<BrainPageCreateRef>().toMatchTypeOf<Ref.AnyPublicMutation>();
    expectTypeOf<Ref.Args<BrainPageCreateRef>>().toMatchTypeOf<{
      readonly workspaceId: string;
      readonly slug: string;
      readonly title: string;
      readonly markdown: string;
    }>();
    expectTypeOf<Ref.Returns<BrainPageCreateRef>>().toMatchTypeOf<string>();
    expectTypeOf<WorkspaceNotFoundVariant<Ref.Error<BrainPageCreateRef>>>()
      .toHaveProperty("workspaceId")
      .toEqualTypeOf<string>();

    expectTypeOf<TemplateMutationResult<BrainPageCreateRef>>().toEqualTypeOf<
      ReactMutation<BrainPageCreateRef>
    >();
    expectTypeOf<
      Extract<
        TemplateMutationState<
          Ref.Returns<BrainPageCreateRef>,
          Ref.Error<BrainPageCreateRef>
        >,
        { readonly mutation: "success" }
      >["data"]
    >().toEqualTypeOf<Ref.Returns<BrainPageCreateRef>>();
    expectTypeOf<
      Extract<
        TemplateMutationState<
          Ref.Returns<BrainPageCreateRef>,
          Ref.Error<BrainPageCreateRef>
        >,
        { readonly status: "typed_failure" }
      >["error"]
    >().toEqualTypeOf<Ref.Error<BrainPageCreateRef>>();
  });

  it("infers generated action args, results, and typed failures", () => {
    expectTypeOf<EvaluateAppIdeaWithModelRef>().toMatchTypeOf<Ref.AnyPublicAction>();
    expectTypeOf<Ref.Args<EvaluateAppIdeaWithModelRef>>().toMatchTypeOf<{
      readonly sessionId: string;
      readonly accessToken: string;
      readonly answers: {
        readonly ideaSummary: string;
        readonly customer: string;
        readonly problem: string;
        readonly currentAlternative: string;
        readonly solution: string;
        readonly differentiation: string;
        readonly distributionEvidence: string;
        readonly founderContext: string;
      };
    }>();
    expectTypeOf<Ref.Returns<EvaluateAppIdeaWithModelRef>>().toMatchTypeOf<{
      readonly status: "completed";
      readonly evaluationId: string;
      readonly reportId: string;
      readonly version: number;
    }>();
    expectTypeOf<Ref.Error<EvaluateAppIdeaWithModelRef>>()
      .toHaveProperty("_tag")
      .toMatchTypeOf<"Unauthorized" | "ValidationFailed" | "Forbidden">();
    expectTypeOf<
      TemplateActionResult<EvaluateAppIdeaWithModelRef>
    >().toEqualTypeOf<
      (
        args: Ref.Args<EvaluateAppIdeaWithModelRef>,
      ) => InvokeReturn<EvaluateAppIdeaWithModelRef>
    >();
  });
});
