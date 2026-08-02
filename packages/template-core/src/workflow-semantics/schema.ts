import * as Schema from "effect/Schema";

export const WorkflowSemanticStatus = Schema.Literals([
  "supported",
  "intentionally-restricted",
  "unsupported",
]);

export const WorkflowSemanticRule = Schema.Struct({
  id: Schema.String,
  subject: Schema.String,
  status: WorkflowSemanticStatus,
  reason: Schema.String,
  repair: Schema.String,
  typedConstructor: Schema.String,
  compilerMapping: Schema.String,
  fixture: Schema.String,
  runtimeGuard: Schema.String,
  documentation: Schema.String,
});

export const WorkflowSemanticContract = Schema.Array(WorkflowSemanticRule);

export type WorkflowSemanticRule = Schema.Schema.Type<
  typeof WorkflowSemanticRule
>;
