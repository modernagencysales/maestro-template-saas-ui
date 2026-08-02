import { GroupSpec, Spec } from "@confect/core";
import access_invitations from "../access/invitations.spec";
import access_members from "../access/members.spec";
import access_provisioning from "../access/provisioning.spec";
import agents_assistant from "../agents/assistant.spec";
import auth_workspaces from "../auth/workspaces.spec";
import brain_pages from "../brain/pages.spec";
import buildPacks_maestro from "../buildPacks/maestro.spec";
import buildPacks_packs from "../buildPacks/packs.spec";
import buildPacks_support from "../buildPacks/support.spec";
import capabilities__versions_publicationEcho_v1 from "../capabilities/_versions/publicationEcho/v1.spec";
import capabilities_catalog from "../capabilities/catalog.spec";
import capabilities_evaluateAppIdea from "../capabilities/evaluateAppIdea.spec";
import capabilities_manageEvaluationReport from "../capabilities/manageEvaluationReport.spec";
import capabilities_sourceGroundedBrief from "../capabilities/sourceGroundedBrief.spec";
import commerce_checkout from "../commerce/checkout.spec";
import commerce_webhooks from "../commerce/webhooks.spec";
import demo_showcase from "../demo/showcase.spec";
import deploy_authority from "../deploy/authority.spec";
import editorSync from "../editorSync.spec";
import jobs_workpool from "../jobs/workpool.spec";
import ops_actions from "../ops/actions.spec";
import ops_billing from "../ops/billing.spec";
import ops_coediting from "../ops/coediting.spec";
import ops_dataLifecycle from "../ops/dataLifecycle.spec";
import ops_flags from "../ops/flags.spec";
import ops_health from "../ops/health.spec";
import ops_knowledge from "../ops/knowledge.spec";
import ops_notifications from "../ops/notifications.spec";
import ops_transforms from "../ops/transforms.spec";
import ops_versioning from "../ops/versioning.spec";
import workflowContracts_generateCompleteBuildPack from "../workflowContracts/generateCompleteBuildPack.spec";
import workflowContracts_publicationFixture from "../workflowContracts/publicationFixture.spec";
import workflowRunners_publicationFixture_v1 from "../workflowRunners/publicationFixture/v1.spec";
import workflows_artifacts from "../workflows/artifacts.spec";
import workflows_effectReservations from "../workflows/effectReservations.spec";
import workflows_eventInstances from "../workflows/eventInstances.spec";
import workflows_lifecycle from "../workflows/lifecycle.spec";
import workflows_stageObservations from "../workflows/stageObservations.spec";
import workflows_subworkflowLinks from "../workflows/subworkflowLinks.spec";
import workflows_subworkflowLinksCurrent from "../workflows/subworkflowLinksCurrent.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "access", never, GroupSpec.NamedAt<typeof access_invitations, "invitations"> | GroupSpec.NamedAt<typeof access_members, "members"> | GroupSpec.NamedAt<typeof access_provisioning, "provisioning">>, "access">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "agents", never, GroupSpec.NamedAt<typeof agents_assistant, "assistant">>, "agents">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_workspaces, "workspaces">>, "auth">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "brain", never, GroupSpec.NamedAt<typeof brain_pages, "pages">>, "brain">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "buildPacks", never, GroupSpec.NamedAt<typeof buildPacks_maestro, "maestro"> | GroupSpec.NamedAt<typeof buildPacks_packs, "packs"> | GroupSpec.NamedAt<typeof buildPacks_support, "support">>, "buildPacks">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "capabilities", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "_versions", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "publicationEcho", never, GroupSpec.NamedAt<typeof capabilities__versions_publicationEcho_v1, "v1">>, "publicationEcho">>, "_versions"> | GroupSpec.NamedAt<typeof capabilities_catalog, "catalog"> | GroupSpec.NamedAt<typeof capabilities_evaluateAppIdea, "evaluateAppIdea"> | GroupSpec.NamedAt<typeof capabilities_manageEvaluationReport, "manageEvaluationReport"> | GroupSpec.NamedAt<typeof capabilities_sourceGroundedBrief, "sourceGroundedBrief">>, "capabilities">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "commerce", never, GroupSpec.NamedAt<typeof commerce_checkout, "checkout"> | GroupSpec.NamedAt<typeof commerce_webhooks, "webhooks">>, "commerce">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "demo", never, GroupSpec.NamedAt<typeof demo_showcase, "showcase">>, "demo">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "deploy", never, GroupSpec.NamedAt<typeof deploy_authority, "authority">>, "deploy">
  | GroupSpec.NamedAt<typeof editorSync, "editorSync">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "jobs", never, GroupSpec.NamedAt<typeof jobs_workpool, "workpool">>, "jobs">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "ops", never, GroupSpec.NamedAt<typeof ops_actions, "actions"> | GroupSpec.NamedAt<typeof ops_billing, "billing"> | GroupSpec.NamedAt<typeof ops_coediting, "coediting"> | GroupSpec.NamedAt<typeof ops_dataLifecycle, "dataLifecycle"> | GroupSpec.NamedAt<typeof ops_flags, "flags"> | GroupSpec.NamedAt<typeof ops_health, "health"> | GroupSpec.NamedAt<typeof ops_knowledge, "knowledge"> | GroupSpec.NamedAt<typeof ops_notifications, "notifications"> | GroupSpec.NamedAt<typeof ops_transforms, "transforms"> | GroupSpec.NamedAt<typeof ops_versioning, "versioning">>, "ops">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflowContracts", never, GroupSpec.NamedAt<typeof workflowContracts_generateCompleteBuildPack, "generateCompleteBuildPack"> | GroupSpec.NamedAt<typeof workflowContracts_publicationFixture, "publicationFixture">>, "workflowContracts">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflowRunners", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "publicationFixture", never, GroupSpec.NamedAt<typeof workflowRunners_publicationFixture_v1, "v1">>, "publicationFixture">>, "workflowRunners">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "workflows", never, GroupSpec.NamedAt<typeof workflows_artifacts, "artifacts"> | GroupSpec.NamedAt<typeof workflows_effectReservations, "effectReservations"> | GroupSpec.NamedAt<typeof workflows_eventInstances, "eventInstances"> | GroupSpec.NamedAt<typeof workflows_lifecycle, "lifecycle"> | GroupSpec.NamedAt<typeof workflows_stageObservations, "stageObservations"> | GroupSpec.NamedAt<typeof workflows_subworkflowLinks, "subworkflowLinks"> | GroupSpec.NamedAt<typeof workflows_subworkflowLinksCurrent, "subworkflowLinksCurrent">>, "workflows">
> = Spec.make().addAt("access", GroupSpec.makeAt("access").addGroupAt("invitations", access_invitations).addGroupAt("members", access_members).addGroupAt("provisioning", access_provisioning)).addAt("agents", GroupSpec.makeAt("agents").addGroupAt("assistant", agents_assistant)).addAt("auth", GroupSpec.makeAt("auth").addGroupAt("workspaces", auth_workspaces)).addAt("brain", GroupSpec.makeAt("brain").addGroupAt("pages", brain_pages)).addAt("buildPacks", GroupSpec.makeAt("buildPacks").addGroupAt("maestro", buildPacks_maestro).addGroupAt("packs", buildPacks_packs).addGroupAt("support", buildPacks_support)).addAt("capabilities", GroupSpec.makeAt("capabilities").addGroupAt("_versions", GroupSpec.makeAt("_versions").addGroupAt("publicationEcho", GroupSpec.makeAt("publicationEcho").addGroupAt("v1", capabilities__versions_publicationEcho_v1))).addGroupAt("catalog", capabilities_catalog).addGroupAt("evaluateAppIdea", capabilities_evaluateAppIdea).addGroupAt("manageEvaluationReport", capabilities_manageEvaluationReport).addGroupAt("sourceGroundedBrief", capabilities_sourceGroundedBrief)).addAt("commerce", GroupSpec.makeAt("commerce").addGroupAt("checkout", commerce_checkout).addGroupAt("webhooks", commerce_webhooks)).addAt("demo", GroupSpec.makeAt("demo").addGroupAt("showcase", demo_showcase)).addAt("deploy", GroupSpec.makeAt("deploy").addGroupAt("authority", deploy_authority)).addAt("editorSync", editorSync).addAt("jobs", GroupSpec.makeAt("jobs").addGroupAt("workpool", jobs_workpool)).addAt("ops", GroupSpec.makeAt("ops").addGroupAt("actions", ops_actions).addGroupAt("billing", ops_billing).addGroupAt("coediting", ops_coediting).addGroupAt("dataLifecycle", ops_dataLifecycle).addGroupAt("flags", ops_flags).addGroupAt("health", ops_health).addGroupAt("knowledge", ops_knowledge).addGroupAt("notifications", ops_notifications).addGroupAt("transforms", ops_transforms).addGroupAt("versioning", ops_versioning)).addAt("workflowContracts", GroupSpec.makeAt("workflowContracts").addGroupAt("generateCompleteBuildPack", workflowContracts_generateCompleteBuildPack).addGroupAt("publicationFixture", workflowContracts_publicationFixture)).addAt("workflowRunners", GroupSpec.makeAt("workflowRunners").addGroupAt("publicationFixture", GroupSpec.makeAt("publicationFixture").addGroupAt("v1", workflowRunners_publicationFixture_v1))).addAt("workflows", GroupSpec.makeAt("workflows").addGroupAt("artifacts", workflows_artifacts).addGroupAt("effectReservations", workflows_effectReservations).addGroupAt("eventInstances", workflows_eventInstances).addGroupAt("lifecycle", workflows_lifecycle).addGroupAt("stageObservations", workflows_stageObservations).addGroupAt("subworkflowLinks", workflows_subworkflowLinks).addGroupAt("subworkflowLinksCurrent", workflows_subworkflowLinksCurrent));

export default spec;
