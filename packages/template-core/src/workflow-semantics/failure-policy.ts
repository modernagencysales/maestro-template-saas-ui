import * as Schema from "effect/Schema";

export const WorkflowSafeFailureCode = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/)),
  Schema.brand("WorkflowSafeFailureCode"),
);

export const WorkflowSafeFailureMessage = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isMaxLength(256)),
  Schema.check(Schema.isPattern(/^[^\r\n]+$/)),
  Schema.brand("WorkflowSafeFailureMessage"),
);

export const WorkflowSettledFailure = Schema.Struct({
  _tag: Schema.Literal("WorkflowSettledFailure"),
  code: WorkflowSafeFailureCode,
  message: WorkflowSafeFailureMessage,
});

export type WorkflowSettledFailure = Schema.Schema.Type<
  typeof WorkflowSettledFailure
>;

export type WorkflowCompensationStep<CapabilityReference, StepName> = {
  readonly forNodeId: string;
  readonly capability: CapabilityReference;
  readonly stepName: StepName;
};

export type WorkflowFailurePolicy<CapabilityReference, StepName> =
  | { readonly kind: "fail" }
  | {
      readonly kind: "error-edge";
      readonly edgeId: string;
      readonly failure: WorkflowSettledFailure;
    }
  | {
      readonly kind: "compensation";
      readonly edgeId: string;
      readonly steps: readonly WorkflowCompensationStep<
        CapabilityReference,
        StepName
      >[];
      readonly failure: WorkflowSettledFailure;
    };

/**
 * Semantic schema factory. Convex instantiates this with the generated
 * WorkflowCapabilityReference and versioned WorkflowStepName schemas.
 */
export const makeWorkflowFailurePolicySchema = <
  CapabilityReference extends string,
  CapabilityEncoded,
  CapabilityContext,
  StepName extends string,
  StepEncoded,
  StepContext,
>({
  WorkflowCapabilityReference,
  WorkflowStepName,
}: {
  readonly WorkflowCapabilityReference: Schema.Codec<
    CapabilityReference,
    CapabilityEncoded,
    CapabilityContext,
    never
  >;
  readonly WorkflowStepName: Schema.Codec<
    StepName,
    StepEncoded,
    StepContext,
    never
  >;
}) =>
  Schema.Union([
    Schema.Struct({ kind: Schema.Literal("fail") }),
    Schema.Struct({
      kind: Schema.Literal("error-edge"),
      edgeId: Schema.NonEmptyString,
      failure: WorkflowSettledFailure,
    }),
    Schema.Struct({
      kind: Schema.Literal("compensation"),
      edgeId: Schema.NonEmptyString,
      steps: Schema.Array(
        Schema.Struct({
          forNodeId: Schema.NonEmptyString,
          capability: WorkflowCapabilityReference,
          stepName: WorkflowStepName,
        }),
      ).pipe(Schema.check(Schema.isMinLength(1))),
      failure: WorkflowSettledFailure,
    }),
  ]);

export const validateDeclaredWorkflowFailureRouting = (
  policy: { readonly kind: "fail" | "error-edge" | "compensation" } | undefined,
  requestedRoute: "error-edge" | "compensation" | undefined,
): readonly string[] =>
  requestedRoute === undefined || policy?.kind === requestedRoute
    ? []
    : [
        `undeclared ${requestedRoute} routing; declare nodes[].failurePolicy or retain fail behavior`,
      ];
