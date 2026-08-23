import { GroupSpec, Spec } from "@confect/core";
import access_invitations from "../access/invitations.spec";
import access_members from "../access/members.spec";
import access_provisioning from "../access/provisioning.spec";
import agents_assistant from "../agents/assistant.spec";
import auth_workspaces from "../auth/workspaces.spec";
import brain_pages from "../brain/pages.spec";
import capabilities_catalog from "../capabilities/catalog.spec";
import capabilities_sourceGroundedBrief from "../capabilities/sourceGroundedBrief.spec";
import deploy_authority from "../deploy/authority.spec";
import editorSync from "../editorSync.spec";
import headless_apiKeys from "../headless/apiKeys.spec";
import integrations_connections from "../integrations/connections.spec";
import jobs_workpool from "../jobs/workpool.spec";
import ops_actions from "../ops/actions.spec";
import ops_billing from "../ops/billing.spec";
import ops_coediting from "../ops/coediting.spec";
import ops_dataLifecycle from "../ops/dataLifecycle.spec";
import ops_email from "../ops/email.spec";
import ops_flags from "../ops/flags.spec";
import ops_health from "../ops/health.spec";
import ops_knowledge from "../ops/knowledge.spec";
import ops_notifications from "../ops/notifications.spec";
import ops_transforms from "../ops/transforms.spec";
import ops_versioning from "../ops/versioning.spec";
import records_records from "../records/records.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "access", never, GroupSpec.NamedAt<typeof access_invitations, "invitations"> | GroupSpec.NamedAt<typeof access_members, "members"> | GroupSpec.NamedAt<typeof access_provisioning, "provisioning">>, "access">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "agents", never, GroupSpec.NamedAt<typeof agents_assistant, "assistant">>, "agents">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_workspaces, "workspaces">>, "auth">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "brain", never, GroupSpec.NamedAt<typeof brain_pages, "pages">>, "brain">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "capabilities", never, GroupSpec.NamedAt<typeof capabilities_catalog, "catalog"> | GroupSpec.NamedAt<typeof capabilities_sourceGroundedBrief, "sourceGroundedBrief">>, "capabilities">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "deploy", never, GroupSpec.NamedAt<typeof deploy_authority, "authority">>, "deploy">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_records, "records">>, "records">
  | GroupSpec.NamedAt<typeof editorSync, "editorSync">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "headless", never, GroupSpec.NamedAt<typeof headless_apiKeys, "apiKeys">>, "headless">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "integrations", never, GroupSpec.NamedAt<typeof integrations_connections, "connections">>, "integrations">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "jobs", never, GroupSpec.NamedAt<typeof jobs_workpool, "workpool">>, "jobs">
  | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "ops", never, GroupSpec.NamedAt<typeof ops_actions, "actions"> | GroupSpec.NamedAt<typeof ops_billing, "billing"> | GroupSpec.NamedAt<typeof ops_coediting, "coediting"> | GroupSpec.NamedAt<typeof ops_dataLifecycle, "dataLifecycle"> | GroupSpec.NamedAt<typeof ops_email, "email"> | GroupSpec.NamedAt<typeof ops_flags, "flags"> | GroupSpec.NamedAt<typeof ops_health, "health"> | GroupSpec.NamedAt<typeof ops_knowledge, "knowledge"> | GroupSpec.NamedAt<typeof ops_notifications, "notifications"> | GroupSpec.NamedAt<typeof ops_transforms, "transforms"> | GroupSpec.NamedAt<typeof ops_versioning, "versioning">>, "ops">
> = Spec.make().addAt("access", GroupSpec.makeAt("access").addGroupAt("invitations", access_invitations).addGroupAt("members", access_members).addGroupAt("provisioning", access_provisioning)).addAt("agents", GroupSpec.makeAt("agents").addGroupAt("assistant", agents_assistant)).addAt("auth", GroupSpec.makeAt("auth").addGroupAt("workspaces", auth_workspaces)).addAt("brain", GroupSpec.makeAt("brain").addGroupAt("pages", brain_pages)).addAt("capabilities", GroupSpec.makeAt("capabilities").addGroupAt("catalog", capabilities_catalog).addGroupAt("sourceGroundedBrief", capabilities_sourceGroundedBrief)).addAt("deploy", GroupSpec.makeAt("deploy").addGroupAt("authority", deploy_authority)).addAt("records", GroupSpec.makeAt("records").addGroupAt("records", records_records)).addAt("editorSync", editorSync).addAt("headless", GroupSpec.makeAt("headless").addGroupAt("apiKeys", headless_apiKeys)).addAt("integrations", GroupSpec.makeAt("integrations").addGroupAt("connections", integrations_connections)).addAt("jobs", GroupSpec.makeAt("jobs").addGroupAt("workpool", jobs_workpool)).addAt("ops", GroupSpec.makeAt("ops").addGroupAt("actions", ops_actions).addGroupAt("billing", ops_billing).addGroupAt("coediting", ops_coediting).addGroupAt("dataLifecycle", ops_dataLifecycle).addGroupAt("email", ops_email).addGroupAt("flags", ops_flags).addGroupAt("health", ops_health).addGroupAt("knowledge", ops_knowledge).addGroupAt("notifications", ops_notifications).addGroupAt("transforms", ops_transforms).addGroupAt("versioning", ops_versioning));

export default spec;
