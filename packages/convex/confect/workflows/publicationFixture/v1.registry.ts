import refs from "../../_generated/refs";
import * as Ref from "@confect/core/Ref";
import { components } from "../../../convex/_generated/api";
import { v } from "convex/values";
import * as Schema from "effect/Schema";
import { defineWorkflowCapabilityRegistry } from "../_kit/graphRunnerV2";
import {
  defineWorkflowEvent,
  defineWorkflowV2EventRegistry,
} from "../_kit/events";
import { defineEmptyWorkflowV2SubworkflowRegistry } from "../_kit/subworkflows";
import { generatedWorkflowSubworkflowPolicy } from "../_kit/workpoolConfig";
import { publicationFixtureReferences } from "./v1.graph";

/**
 * Generated typed capability registry. Add entries only through generated
 * internal refs. External actions must declare effect strategy, effect class,
 * logical instance-key mapping, dedupe/restart horizons, guard postures,
 * redaction policy, and provider/reconciliation fixture evidence.
 * Query and mutation nodes use an independent Workpool transaction by default.
 * Inline nodes must be authored with a named generated preset.
 */
export const publicationFixtureCapabilityRegistry =
  defineWorkflowCapabilityRegistry({});

export const publicationFixtureSubworkflowLinkRefs = {
  reserveRef: refs.internal.workflows.subworkflowLinks.reserve,
  reconcileRef: refs.internal.workflows.subworkflowLinks.reconcile,
  reportReconciliationFailureRef:
    refs.internal.workflows.subworkflowLinks.reportReconciliationFailure,
} as const;

export const publicationFixtureEventInstanceRefs = {
  loadGeneration: components.workflow.journal.load,
  createComponentEvent: components.workflow.event.create,
  allocate: Ref.getFunctionReference(
    refs.internal.workflows.eventInstances.allocate,
  ),
  reconcile: Ref.getFunctionReference(
    refs.internal.workflows.eventInstances.reconcile,
  ),
} as const;

export const publicationFixtureApprovalDecisionEvent = defineWorkflowEvent({
  reference: publicationFixtureReferences.events.approvalDecision,
  name: "publication-fixture-approval-decision.v1",
  schemaName: "workflows.publicationFixture.approvalDecision.v1",
  schema: Schema.Struct({ approved: Schema.Boolean }),
  validator: v.object({ approved: v.boolean() }),
});

/** Generated typed event entries bind component and persisted internal refs. */
export const publicationFixtureEventRegistry = defineWorkflowV2EventRegistry({
  [publicationFixtureApprovalDecisionEvent.reference]: {
    definition: publicationFixtureApprovalDecisionEvent,
    creatorCapability: publicationFixtureReferences.capabilities.eventControl,
    refs: publicationFixtureEventInstanceRefs,
  },
});

/**
 * Generated immutable child registry. Every entry declares its exact version,
 * typed Args/Result mapping, transitive children, principal narrowing, and the
 * shared typed workflowRunLinks reserve/reconcile refs above.
 */
export const publicationFixtureSubworkflowRegistry =
  defineEmptyWorkflowV2SubworkflowRegistry();

export const publicationFixtureSubworkflowPolicy =
  generatedWorkflowSubworkflowPolicy;
