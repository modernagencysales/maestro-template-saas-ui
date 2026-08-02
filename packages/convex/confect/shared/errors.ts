import * as Schema from "effect/Schema";

export const ErrorCode = Schema.Literals([
  "UNAUTHENTICATED",
  "NO_WORKSPACE_ACCESS",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "SPEND_CAP_EXCEEDED",
  "LLM_DISABLED",
  "PROVIDER_CONFIG_INVALID",
  "POLICY_NOT_FOUND",
  "PROMPT_NOT_FOUND",
  "INTERNAL",
]);

export type ErrorCode = Schema.Schema.Type<typeof ErrorCode>;

export const PublicErrorDetails = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
);

export class TemplatePublicError extends Schema.TaggedErrorClass<TemplatePublicError>()(
  "TemplatePublicError",
  {
    code: ErrorCode,
    message: Schema.String,
    details: Schema.optional(PublicErrorDetails),
  },
) {}

export const makePublicError = (
  code: ErrorCode,
  message: string,
  details?: Schema.Schema.Type<typeof PublicErrorDetails>,
): TemplatePublicError =>
  details
    ? new TemplatePublicError({ code, message, details })
    : new TemplatePublicError({ code, message });

export const redactUnknownError = (error: unknown): TemplatePublicError => {
  if (error instanceof TemplatePublicError) {
    return error;
  }

  return makePublicError("INTERNAL", "Unexpected internal error.");
};
