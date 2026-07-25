import {
  defineEvent,
  type EventId as ComponentEventId,
} from "@convex-dev/workflow";
import type { Infer, Validator } from "convex/values";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { makePublicError } from "../../shared/errors";
import type { WorkflowNodeV2 } from "../graph";
import {
  WorkflowEventReference,
  type WorkflowEventReference as WorkflowEventReferenceType,
} from "./workflowReferences";
import type { RunDurableGraphStep } from "./graphRunner";

type EventNodeV2 = Extract<WorkflowNodeV2, { readonly kind: "event" }>;

/** Opaque product identifier. It is deliberately distinct from component IDs. */
export const ProductWorkflowEventId = Schema.String.pipe(
  Schema.brand("ProductWorkflowEventId"),
);
export type ProductWorkflowEventId = Schema.Schema.Type<
  typeof ProductWorkflowEventId
>;

export type WorkflowEventDefinition<
  Value,
  Name extends string = string,
  V extends Validator<unknown, "required", string> = Validator<
    Value,
    "required",
    string
  >,
> = {
  readonly reference: WorkflowEventReferenceType;
  readonly name: Name;
  readonly schemaName: string;
  readonly schema: Schema.Schema<Value>;
  readonly validator: V;
};

/** One shared definition supplies both the real Convex validator and value type. */
export const defineWorkflowEvent = <
  const Name extends string,
  V extends Validator<unknown, "required", string>,
>(input: {
  readonly reference: WorkflowEventReferenceType;
  readonly name: Name;
  readonly schemaName: string;
  readonly schema: Schema.Schema<Infer<V>>;
  readonly validator: V;
}): WorkflowEventDefinition<Infer<V>, Name, V> => {
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.v[1-9]\d*$/.test(input.name) ||
    input.schemaName.length === 0
  ) {
    throw makePublicError(
      "VALIDATION_FAILED",
      "Workflow event definition is invalid.",
    );
  }
  const shared = defineEvent({ name: input.name, validator: input.validator });
  return { ...input, ...shared };
};

export type WorkflowEventValue<Definition> =
  Definition extends WorkflowEventDefinition<infer Value> ? Value : never;

export type WorkflowEventOwnership = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly generation: number;
  readonly eventDefinition: WorkflowEventReferenceType;
  readonly eventInstanceKey: string;
};

export type OwnedWorkflowEvent<Name extends string = string> =
  WorkflowEventOwnership & {
    readonly eventId: ProductWorkflowEventId;
    readonly componentEventId: ComponentEventId<Name>;
  };

export type WorkflowV2EventRegistryEntry<
  Value,
  Name extends string = string,
  V extends Validator<unknown, "required", string> = Validator<
    Value,
    "required",
    string
  >,
> = {
  readonly definition: WorkflowEventDefinition<Value, Name, V>;
  readonly locate: (
    ownership: WorkflowEventOwnership,
  ) => Promise<OwnedWorkflowEvent<Name>>;
};

type AnyWorkflowEventDefinition = WorkflowEventDefinition<
  any,
  string,
  Validator<any, "required", string>
>;

export type AnyWorkflowV2EventRegistryEntry = {
  readonly definition: AnyWorkflowEventDefinition;
  readonly locate: (
    ownership: WorkflowEventOwnership,
  ) => Promise<OwnedWorkflowEvent<string>>;
};

export const defineWorkflowV2EventRegistry = <
  const Registry extends Readonly<
    Record<string, AnyWorkflowV2EventRegistryEntry>
  >,
>(
  registry: Registry,
): Registry => {
  for (const [key, entry] of Object.entries(registry)) {
    const decoded = Schema.decodeUnknownEither(WorkflowEventReference)(key);
    if (Either.isLeft(decoded) || entry.definition.reference !== key) {
      throw makePublicError(
        "VALIDATION_FAILED",
        "Event registry key must match its generated typed definition.",
      );
    }
  }
  return registry;
};

type RunEventInput<Entry> = {
  readonly step: RunDurableGraphStep;
  readonly node: EventNodeV2;
  readonly entry: Entry;
  readonly ownership: Pick<
    WorkflowEventOwnership,
    "workspaceId" | "workflowRunId" | "generation"
  >;
};

export function runRegisteredWorkflowEvent<
  Value,
  Name extends string,
  V extends Validator<unknown, "required", string>,
>(
  input: RunEventInput<WorkflowV2EventRegistryEntry<Value, Name, V>>,
): Promise<Value>;
export function runRegisteredWorkflowEvent(
  input: RunEventInput<AnyWorkflowV2EventRegistryEntry>,
): Promise<unknown>;
export async function runRegisteredWorkflowEvent({
  step,
  node,
  entry,
  ownership,
}: RunEventInput<AnyWorkflowV2EventRegistryEntry>): Promise<unknown> {
  if (
    entry.definition.reference !== node.eventDefinition ||
    entry.definition.schemaName !== node.eventSchemaName
  ) {
    throw unavailableEvent();
  }
  const instanceKey = validateEventInstanceKey(node.eventInstanceKey);
  const expected: WorkflowEventOwnership = {
    ...ownership,
    eventDefinition: node.eventDefinition,
    eventInstanceKey: instanceKey,
  };
  const owned = await entry.locate(expected);
  assertExactOwnership(owned, expected);
  const runtimeName = `${entry.definition.name}.${instanceKey}`;
  return step.awaitEvent({
    id: owned.componentEventId,
    name: runtimeName,
    validator: entry.definition.validator,
  });
}

export const validateEventInstanceKey = (value: string): string => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw unavailableEvent();
  }
  return value;
};

const assertExactOwnership = (
  actual: OwnedWorkflowEvent,
  expected: WorkflowEventOwnership,
): void => {
  if (
    typeof actual.eventId !== "string" ||
    actual.eventId.length === 0 ||
    typeof actual.componentEventId !== "string" ||
    actual.componentEventId.length === 0 ||
    actual.workspaceId !== expected.workspaceId ||
    actual.workflowRunId !== expected.workflowRunId ||
    actual.generation !== expected.generation ||
    actual.eventDefinition !== expected.eventDefinition ||
    actual.eventInstanceKey !== expected.eventInstanceKey
  ) {
    throw unavailableEvent();
  }
};

const unavailableEvent = () =>
  makePublicError("VALIDATION_FAILED", "Workflow event is unavailable.");
