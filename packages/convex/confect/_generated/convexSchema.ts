import { defineSchema as $defineSchema } from "convex/server";

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
import deployActionConsumptions from "./tables/deployActionConsumptions";
import deployApprovals from "./tables/deployApprovals";
import deployAuthorityIssuers from "./tables/deployAuthorityIssuers";
import deployCensusSnapshots from "./tables/deployCensusSnapshots";
import deployVerdicts from "./tables/deployVerdicts";
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
import workflowArtifacts from "./tables/workflowArtifacts";
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

export default $defineSchema({
  accessAuditEvents: accessAuditEvents.tableDefinition,
  actionApprovals: actionApprovals.tableDefinition,
  actionDigests: actionDigests.tableDefinition,
  actionJobs: actionJobs.tableDefinition,
  actionTriggers: actionTriggers.tableDefinition,
  apiKeys: apiKeys.tableDefinition,
  billingPlans: billingPlans.tableDefinition,
  brainPages: brainPages.tableDefinition,
  citations: citations.tableDefinition,
  claims: claims.tableDefinition,
  concepts: concepts.tableDefinition,
  contextPacks: contextPacks.tableDefinition,
  creditLedger: creditLedger.tableDefinition,
  deployActionConsumptions: deployActionConsumptions.tableDefinition,
  deployApprovals: deployApprovals.tableDefinition,
  deployAuthorityIssuers: deployAuthorityIssuers.tableDefinition,
  deployCensusSnapshots: deployCensusSnapshots.tableDefinition,
  deployVerdicts: deployVerdicts.tableDefinition,
  documentAnnotations: documentAnnotations.tableDefinition,
  documentVersions: documentVersions.tableDefinition,
  documents: documents.tableDefinition,
  dsarRequests: dsarRequests.tableDefinition,
  entitlements: entitlements.tableDefinition,
  featureFlagPolicies: featureFlagPolicies.tableDefinition,
  invitations: invitations.tableDefinition,
  notificationPreferences: notificationPreferences.tableDefinition,
  notificationRecords: notificationRecords.tableDefinition,
  organizationMembers: organizationMembers.tableDefinition,
  organizations: organizations.tableDefinition,
  policies: policies.tableDefinition,
  promptRegistry: promptRegistry.tableDefinition,
  transformBlocks: transformBlocks.tableDefinition,
  transformDefinitions: transformDefinitions.tableDefinition,
  transformRuns: transformRuns.tableDefinition,
  usageEvents: usageEvents.tableDefinition,
  users: users.tableDefinition,
  versionFreshness: versionFreshness.tableDefinition,
  versionedEntries: versionedEntries.tableDefinition,
  webhookEvents: webhookEvents.tableDefinition,
  workflowArtifacts: workflowArtifacts.tableDefinition,
  workflowEffectReservations: workflowEffectReservations.tableDefinition,
  workflowEventInstances: workflowEventInstances.tableDefinition,
  workflowRunContextManifests: workflowRunContextManifests.tableDefinition,
  workflowRunEvents: workflowRunEvents.tableDefinition,
  workflowRunEvidenceSnapshots: workflowRunEvidenceSnapshots.tableDefinition,
  workflowRunLinks: workflowRunLinks.tableDefinition,
  workflowRuns: workflowRuns.tableDefinition,
  workflowStageRuns: workflowStageRuns.tableDefinition,
  workspaceMembers: workspaceMembers.tableDefinition,
  workspaces: workspaces.tableDefinition,
});
