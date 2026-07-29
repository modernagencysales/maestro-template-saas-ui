/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access_invitations from "../access/invitations.js";
import type * as access_members from "../access/members.js";
import type * as access_provisioning from "../access/provisioning.js";
import type * as agents_assistant from "../agents/assistant.js";
import type * as auth_workspaces from "../auth/workspaces.js";
import type * as brain_pages from "../brain/pages.js";
import type * as capabilities__versions_publicationEcho_v1 from "../capabilities/_versions/publicationEcho/v1.js";
import type * as capabilities_catalog from "../capabilities/catalog.js";
import type * as capabilities_sourceGroundedBrief from "../capabilities/sourceGroundedBrief.js";
import type * as demo_showcase from "../demo/showcase.js";
import type * as deploy_authority from "../deploy/authority.js";
import type * as editorSync from "../editorSync.js";
import type * as http from "../http.js";
import type * as jobs_workpool from "../jobs/workpool.js";
import type * as ops_actions from "../ops/actions.js";
import type * as ops_billing from "../ops/billing.js";
import type * as ops_coediting from "../ops/coediting.js";
import type * as ops_dataLifecycle from "../ops/dataLifecycle.js";
import type * as ops_flags from "../ops/flags.js";
import type * as ops_health from "../ops/health.js";
import type * as ops_knowledge from "../ops/knowledge.js";
import type * as ops_notifications from "../ops/notifications.js";
import type * as ops_transforms from "../ops/transforms.js";
import type * as ops_versioning from "../ops/versioning.js";
import type * as workflowContracts_publicationFixture from "../workflowContracts/publicationFixture.js";
import type * as workflowRunners_publicationFixture_v1 from "../workflowRunners/publicationFixture/v1.js";
import type * as workflows_artifacts from "../workflows/artifacts.js";
import type * as workflows_deadlinesCurrent from "../workflows/deadlinesCurrent.js";
import type * as workflows_effectReservations from "../workflows/effectReservations.js";
import type * as workflows_eventInstances from "../workflows/eventInstances.js";
import type * as workflows_lifecycle from "../workflows/lifecycle.js";
import type * as workflows_stageObservations from "../workflows/stageObservations.js";
import type * as workflows_subworkflowLinks from "../workflows/subworkflowLinks.js";
import type * as workflows_subworkflowLinksCurrent from "../workflows/subworkflowLinksCurrent.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "access/invitations": typeof access_invitations;
  "access/members": typeof access_members;
  "access/provisioning": typeof access_provisioning;
  "agents/assistant": typeof agents_assistant;
  "auth/workspaces": typeof auth_workspaces;
  "brain/pages": typeof brain_pages;
  "capabilities/_versions/publicationEcho/v1": typeof capabilities__versions_publicationEcho_v1;
  "capabilities/catalog": typeof capabilities_catalog;
  "capabilities/sourceGroundedBrief": typeof capabilities_sourceGroundedBrief;
  "demo/showcase": typeof demo_showcase;
  "deploy/authority": typeof deploy_authority;
  editorSync: typeof editorSync;
  http: typeof http;
  "jobs/workpool": typeof jobs_workpool;
  "ops/actions": typeof ops_actions;
  "ops/billing": typeof ops_billing;
  "ops/coediting": typeof ops_coediting;
  "ops/dataLifecycle": typeof ops_dataLifecycle;
  "ops/flags": typeof ops_flags;
  "ops/health": typeof ops_health;
  "ops/knowledge": typeof ops_knowledge;
  "ops/notifications": typeof ops_notifications;
  "ops/transforms": typeof ops_transforms;
  "ops/versioning": typeof ops_versioning;
  "workflowContracts/publicationFixture": typeof workflowContracts_publicationFixture;
  "workflowRunners/publicationFixture/v1": typeof workflowRunners_publicationFixture_v1;
  "workflows/artifacts": typeof workflows_artifacts;
  "workflows/deadlinesCurrent": typeof workflows_deadlinesCurrent;
  "workflows/effectReservations": typeof workflows_effectReservations;
  "workflows/eventInstances": typeof workflows_eventInstances;
  "workflows/lifecycle": typeof workflows_lifecycle;
  "workflows/stageObservations": typeof workflows_stageObservations;
  "workflows/subworkflowLinks": typeof workflows_subworkflowLinks;
  "workflows/subworkflowLinksCurrent": typeof workflows_subworkflowLinksCurrent;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  posthog: import("@posthog/convex/_generated/component.js").ComponentApi<"posthog">;
  workpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workpool">;
  workflowDeadlineWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workflowDeadlineWorkpool">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  workflowDeadline: import("../components/workflowDeadline/_generated/component.js").ComponentApi<"workflowDeadline">;
  workflowAdmission: import("../components/workflowAdmission/_generated/component.js").ComponentApi<"workflowAdmission">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
};
