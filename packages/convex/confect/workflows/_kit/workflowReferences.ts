import * as Schema from "effect/Schema";

const capabilityRefPattern = /^capability\.[a-z][A-Za-z0-9]*\.v[1-9]\d*$/;
const workflowRefPattern = /^workflow\.[a-z][A-Za-z0-9]*\.v[1-9]\d*$/;
const eventRefPattern = /^event\.[a-z][A-Za-z0-9]*\.v[1-9]\d*$/;
const stepNamePattern =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.v[1-9]\d*(?:\.i-(?:n\d{6,}|k\d+-[a-z0-9]+(?:-[a-z0-9]+)*))?$/;

export const WorkflowCapabilityReference = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(capabilityRefPattern)),
  Schema.brand("WorkflowCapabilityReference"),
);
export type WorkflowCapabilityReference = Schema.Schema.Type<
  typeof WorkflowCapabilityReference
>;

export const WorkflowReference = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(workflowRefPattern)),
  Schema.brand("WorkflowReference"),
);
export type WorkflowReference = Schema.Schema.Type<typeof WorkflowReference>;

export const WorkflowEventReference = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(eventRefPattern)),
  Schema.brand("WorkflowEventReference"),
);
export type WorkflowEventReference = Schema.Schema.Type<
  typeof WorkflowEventReference
>;

export const WorkflowStepName = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(stepNamePattern)),
);
export type WorkflowStepName = Schema.Schema.Type<typeof WorkflowStepName>;

type ReferenceRegistryInput = {
  readonly capabilities: Readonly<Record<string, string>>;
  readonly workflows: Readonly<Record<string, string>>;
  readonly events: Readonly<Record<string, string>>;
};

type DecodeRegistry<Input extends Readonly<Record<string, string>>, Ref> = {
  readonly [Key in keyof Input]: Ref;
};

/**
 * Generator boundary for durable registry references. Callers consume the
 * returned branded values; graph authors never type an unvalidated function or
 * event string directly.
 */
export const defineWorkflowReferenceRegistry = <
  const Input extends ReferenceRegistryInput,
>(
  input: Input,
): {
  readonly capabilities: DecodeRegistry<
    Input["capabilities"],
    WorkflowCapabilityReference
  >;
  readonly workflows: DecodeRegistry<Input["workflows"], WorkflowReference>;
  readonly events: DecodeRegistry<Input["events"], WorkflowEventReference>;
} => ({
  capabilities: decodeEntries(
    WorkflowCapabilityReference,
    input.capabilities,
  ) as DecodeRegistry<Input["capabilities"], WorkflowCapabilityReference>,
  workflows: decodeEntries(
    WorkflowReference,
    input.workflows,
  ) as DecodeRegistry<Input["workflows"], WorkflowReference>,
  events: decodeEntries(WorkflowEventReference, input.events) as DecodeRegistry<
    Input["events"],
    WorkflowEventReference
  >,
});

const decodeEntries = <Ref>(
  schema: Schema.Codec<Ref, string>,
  entries: Readonly<Record<string, string>>,
): Readonly<Record<string, Ref>> =>
  Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [
      key,
      Schema.decodeSync(schema)(value),
    ]),
  );
