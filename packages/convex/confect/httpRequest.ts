import {
  type HeadlessExecutorRequest,
  type JsonValue,
} from "./manifest/executor";

export type TemplateApiRequestBody = {
  readonly workspaceSlug?: string;
  readonly input?: Record<string, JsonValue>;
  readonly idempotencyKey?: string;
  readonly correlationNonce?: string;
};

type TemplateHttpFailure = {
  readonly ok: false;
  readonly error: {
    readonly _tag: "ValidationFailed";
    readonly message: string;
  };
};

type ParsedTemplateApiRequestBody =
  | { readonly ok: true; readonly body: TemplateApiRequestBody }
  | TemplateHttpFailure;

type ExecutorRequestResult =
  | { readonly ok: true; readonly request: HeadlessExecutorRequest }
  | TemplateHttpFailure;

type CreateMarkdownInputs = {
  readonly slug: string;
  readonly title: string;
  readonly markdown: string;
};

const createMarkdownInputFields = [
  "slug",
  "title",
  "markdown",
] as const satisfies readonly (keyof CreateMarkdownInputs)[];

const validationFailed = (message: string): TemplateHttpFailure => ({
  ok: false,
  error: {
    _tag: "ValidationFailed",
    message,
  },
});

export const readJsonBody = async (
  request: Request,
): Promise<ParsedTemplateApiRequestBody> => {
  let parsed: ParsedTemplateApiRequestBody = { ok: true, body: {} };

  if (hasJsonRequestBody(request)) {
    parsed = await parseJsonRequestBody(request);
  }

  return parsed;
};

const hasJsonRequestBody = (request: Request): boolean => {
  const contentType = request.headers.get("content-type") ?? "";
  return request.body !== null && contentType.includes("application/json");
};

const parseJsonRequestBody = async (
  request: Request,
): Promise<ParsedTemplateApiRequestBody> => {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return validationFailed("Request body must be valid JSON.");
  }

  return { ok: true, body: templateApiRequestBodyFrom(value) };
};

const templateApiRequestBodyFrom = (value: unknown): TemplateApiRequestBody => {
  if (!isObjectRecord(value)) return {};

  return {
    ...(typeof value.workspaceSlug === "string"
      ? { workspaceSlug: value.workspaceSlug }
      : {}),
    ...(isObjectRecord(value.input)
      ? { input: value.input as Record<string, JsonValue> }
      : {}),
    ...(typeof value.idempotencyKey === "string"
      ? { idempotencyKey: value.idempotencyKey }
      : {}),
    ...(typeof value.correlationNonce === "string"
      ? { correlationNonce: value.correlationNonce }
      : {}),
  };
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const executorRequestFor = (
  operationId: string,
  body: TemplateApiRequestBody,
  authority?: {
    readonly surface?: "api" | "cli";
    readonly workspaceId?: string;
  },
): ExecutorRequestResult => {
  const callerInput = body.input ?? {};
  const callerWorkspaceId = callerInput.workspaceId;
  if (
    authority?.workspaceId !== undefined &&
    typeof callerWorkspaceId === "string" &&
    callerWorkspaceId.trim() !== authority.workspaceId
  )
    return validationFailed(
      "Caller workspace does not match principal authority.",
    );
  const input =
    authority?.workspaceId === undefined
      ? callerInput
      : { ...callerInput, workspaceId: authority.workspaceId };
  const result =
    operationId === "brain.pages.createMarkdown"
      ? createMarkdownExecutorRequest(operationId, body, input, authority)
      : genericExecutorRequest(operationId, body, input, authority?.surface);

  return result;
};

const genericExecutorRequest = (
  operationId: string,
  body: TemplateApiRequestBody,
  input: Record<string, JsonValue>,
  surface: "api" | "cli" = "api",
): ExecutorRequestResult => ({
  ok: true,
  request: {
    operationId,
    surface,
    input,
    ...(body.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: body.idempotencyKey }),
    ...(body.workspaceSlug === undefined
      ? {}
      : { workspaceSlug: body.workspaceSlug }),
    ...(body.correlationNonce === undefined
      ? {}
      : { correlationNonce: body.correlationNonce }),
  },
});

const createMarkdownExecutorRequest = (
  operationId: string,
  body: TemplateApiRequestBody,
  input: Record<string, JsonValue>,
  authority?: { readonly surface?: "api" | "cli" },
): ExecutorRequestResult => {
  let result: ExecutorRequestResult | undefined =
    createMarkdownIdempotencyFailure(body);

  if (result === undefined) {
    result = createMarkdownExecutorRequestWithIdempotency(
      operationId,
      body,
      input,
      authority?.surface,
    );
  }

  return result;
};

const createMarkdownIdempotencyFailure = (
  body: TemplateApiRequestBody,
): TemplateHttpFailure | undefined => {
  const hasInvalidIdempotencyKey =
    body.idempotencyKey?.trim() === "" || body.idempotencyKey === undefined;
  return hasInvalidIdempotencyKey
    ? validationFailed(
        "Operation brain.pages.createMarkdown requires a nonblank idempotencyKey.",
      )
    : undefined;
};

const createMarkdownExecutorRequestWithIdempotency = (
  operationId: string,
  body: TemplateApiRequestBody,
  input: Record<string, JsonValue>,
  surface: "api" | "cli" = "api",
): ExecutorRequestResult => {
  const workspaceId = createMarkdownWorkspaceId(input);
  const result: ExecutorRequestResult = workspaceId
    ? createMarkdownExecutorRequestWithWorkspace(
        operationId,
        body,
        input,
        workspaceId,
        surface,
      )
    : validationFailed(
        "Operation brain.pages.createMarkdown requires input.workspaceId or a known workspaceSlug.",
      );

  return result;
};

const createMarkdownWorkspaceId = (
  input: Record<string, JsonValue>,
): string | undefined =>
  typeof input.workspaceId === "string" && input.workspaceId.trim()
    ? input.workspaceId.trim()
    : undefined;

const createMarkdownExecutorRequestWithWorkspace = (
  operationId: string,
  body: TemplateApiRequestBody,
  input: Record<string, JsonValue>,
  workspaceId: string,
  surface: "api" | "cli",
): ExecutorRequestResult => {
  const fields = requiredCreateMarkdownInputs(operationId, input);
  const result: ExecutorRequestResult = fields.ok
    ? {
        ok: true,
        request: {
          operationId,
          surface,
          input: {
            workspaceId,
            ...fields.values,
          },
          ...(body.idempotencyKey === undefined
            ? {}
            : { idempotencyKey: body.idempotencyKey }),
          ...(body.workspaceSlug === undefined
            ? {}
            : { workspaceSlug: body.workspaceSlug }),
          ...(body.correlationNonce === undefined
            ? {}
            : { correlationNonce: body.correlationNonce }),
        },
      }
    : fields;

  return result;
};

const requiredCreateMarkdownInputs = (
  operationId: string,
  input: Record<string, JsonValue>,
):
  | { readonly ok: true; readonly values: CreateMarkdownInputs }
  | TemplateHttpFailure => {
  const invalidField = createMarkdownInputFields.find(
    (field) => !hasRequiredStringInput(input, field),
  );
  const result =
    invalidField === undefined
      ? {
          ok: true as const,
          values: {
            slug: input.slug as string,
            title: input.title as string,
            markdown: input.markdown as string,
          },
        }
      : validationFailed(
          `Operation ${operationId} requires nonblank input.${invalidField}.`,
        );

  return result;
};

const hasRequiredStringInput = (
  input: Record<string, JsonValue>,
  field: keyof CreateMarkdownInputs,
): boolean => {
  const value = input[field];
  const result = typeof value === "string" ? value.trim().length > 0 : false;

  return result;
};
