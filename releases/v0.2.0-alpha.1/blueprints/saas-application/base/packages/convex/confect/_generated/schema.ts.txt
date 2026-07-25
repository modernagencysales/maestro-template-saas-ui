import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import accessAuditEvents from "./tables/accessAuditEvents";
import actionApprovals from "./tables/actionApprovals";
import actionDigests from "./tables/actionDigests";
import actionJobs from "./tables/actionJobs";
import actionTriggers from "./tables/actionTriggers";
import apiKeys from "./tables/apiKeys";
import billingPlans from "./tables/billingPlans";
import brainPages from "./tables/brainPages";
import citations from "./tables/citations";
import claims from "./tables/claims";
import concepts from "./tables/concepts";
import contextPacks from "./tables/contextPacks";
import creditLedger from "./tables/creditLedger";
import documentAnnotations from "./tables/documentAnnotations";
import documentVersions from "./tables/documentVersions";
import documents from "./tables/documents";
import dsarRequests from "./tables/dsarRequests";
import entitlements from "./tables/entitlements";
import featureFlagPolicies from "./tables/featureFlagPolicies";
import invitations from "./tables/invitations";
import notificationPreferences from "./tables/notificationPreferences";
import notificationRecords from "./tables/notificationRecords";
import organizationMembers from "./tables/organizationMembers";
import organizations from "./tables/organizations";
import policies from "./tables/policies";
import promptRegistry from "./tables/promptRegistry";
import transformBlocks from "./tables/transformBlocks";
import transformDefinitions from "./tables/transformDefinitions";
import transformRuns from "./tables/transformRuns";
import usageEvents from "./tables/usageEvents";
import users from "./tables/users";
import versionFreshness from "./tables/versionFreshness";
import versionedEntries from "./tables/versionedEntries";
import webhookEvents from "./tables/webhookEvents";
import workflowEffectReservations from "./tables/workflowEffectReservations";
import workflowEventInstances from "./tables/workflowEventInstances";
import workflowRunContextManifests from "./tables/workflowRunContextManifests";
import workflowRunEvents from "./tables/workflowRunEvents";
import workflowRunEvidenceSnapshots from "./tables/workflowRunEvidenceSnapshots";
import workflowRunLinks from "./tables/workflowRunLinks";
import workflowRuns from "./tables/workflowRuns";
import workflowStageRuns from "./tables/workflowStageRuns";
import workspaceMembers from "./tables/workspaceMembers";
import workspaces from "./tables/workspaces";

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof accessAuditEvents |
  typeof actionApprovals |
  typeof actionDigests |
  typeof actionJobs |
  typeof actionTriggers |
  typeof apiKeys |
  typeof billingPlans |
  typeof brainPages |
  typeof citations |
  typeof claims |
  typeof concepts |
  typeof contextPacks |
  typeof creditLedger |
  typeof documentAnnotations |
  typeof documentVersions |
  typeof documents |
  typeof dsarRequests |
  typeof entitlements |
  typeof featureFlagPolicies |
  typeof invitations |
  typeof notificationPreferences |
  typeof notificationRecords |
  typeof organizationMembers |
  typeof organizations |
  typeof policies |
  typeof promptRegistry |
  typeof transformBlocks |
  typeof transformDefinitions |
  typeof transformRuns |
  typeof usageEvents |
  typeof users |
  typeof versionFreshness |
  typeof versionedEntries |
  typeof webhookEvents |
  typeof workflowEffectReservations |
  typeof workflowEventInstances |
  typeof workflowRunContextManifests |
  typeof workflowRunEvents |
  typeof workflowRunEvidenceSnapshots |
  typeof workflowRunLinks |
  typeof workflowRuns |
  typeof workflowStageRuns |
  typeof workspaceMembers |
  typeof workspaces
> = $DatabaseSchema.make({
  accessAuditEvents,
  actionApprovals,
  actionDigests,
  actionJobs,
  actionTriggers,
  apiKeys,
  billingPlans,
  brainPages,
  citations,
  claims,
  concepts,
  contextPacks,
  creditLedger,
  documentAnnotations,
  documentVersions,
  documents,
  dsarRequests,
  entitlements,
  featureFlagPolicies,
  invitations,
  notificationPreferences,
  notificationRecords,
  organizationMembers,
  organizations,
  policies,
  promptRegistry,
  transformBlocks,
  transformDefinitions,
  transformRuns,
  usageEvents,
  users,
  versionFreshness,
  versionedEntries,
  webhookEvents,
  workflowEffectReservations,
  workflowEventInstances,
  workflowRunContextManifests,
  workflowRunEvents,
  workflowRunEvidenceSnapshots,
  workflowRunLinks,
  workflowRuns,
  workflowStageRuns,
  workspaceMembers,
  workspaces,
});

export default databaseSchema;
