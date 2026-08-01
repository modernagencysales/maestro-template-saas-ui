import { defineSchema as $defineSchema } from "convex/server";

import accessAuditEvents from "./tables/accessAuditEvents";
import actionApprovals from "./tables/actionApprovals";
import actionDigests from "./tables/actionDigests";
import actionJobs from "./tables/actionJobs";
import actionTriggers from "./tables/actionTriggers";
import apiKeys from "./tables/apiKeys";
import billingPlans from "./tables/billingPlans";
import brainPages from "./tables/brainPages";
import buildPackEntitlements from "./tables/buildPackEntitlements";
import buildPackExports from "./tables/buildPackExports";
import buildPackStages from "./tables/buildPackStages";
import buildPacks from "./tables/buildPacks";
import checkoutSessions from "./tables/checkoutSessions";
import citations from "./tables/citations";
import claims from "./tables/claims";
import commerceRevocations from "./tables/commerceRevocations";
import concepts from "./tables/concepts";
import contextPacks from "./tables/contextPacks";
import creditLedger from "./tables/creditLedger";
import documentAnnotations from "./tables/documentAnnotations";
import documentVersions from "./tables/documentVersions";
import documents from "./tables/documents";
import dsarRequests from "./tables/dsarRequests";
import emailVerificationChallenges from "./tables/emailVerificationChallenges";
import entitlements from "./tables/entitlements";
import evaluationAnswers from "./tables/evaluationAnswers";
import evaluationReportVersions from "./tables/evaluationReportVersions";
import evaluationReports from "./tables/evaluationReports";
import evaluationSessions from "./tables/evaluationSessions";
import evaluationShares from "./tables/evaluationShares";
import featureFlagPolicies from "./tables/featureFlagPolicies";
import invitations from "./tables/invitations";
import maestroCredits from "./tables/maestroCredits";
import modelReceipts from "./tables/modelReceipts";
import notificationPreferences from "./tables/notificationPreferences";
import notificationRecords from "./tables/notificationRecords";
import organizationMembers from "./tables/organizationMembers";
import organizations from "./tables/organizations";
import policies from "./tables/policies";
import promptRegistry from "./tables/promptRegistry";
import purchases from "./tables/purchases";
import reportOwnerships from "./tables/reportOwnerships";
import supportIncidents from "./tables/supportIncidents";
import transformBlocks from "./tables/transformBlocks";
import transformDefinitions from "./tables/transformDefinitions";
import transformRuns from "./tables/transformRuns";
import usageEvents from "./tables/usageEvents";
import users from "./tables/users";
import versionFreshness from "./tables/versionFreshness";
import versionedEntries from "./tables/versionedEntries";
import webhookEvents from "./tables/webhookEvents";
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
  buildPackEntitlements: buildPackEntitlements.tableDefinition,
  buildPackExports: buildPackExports.tableDefinition,
  buildPackStages: buildPackStages.tableDefinition,
  buildPacks: buildPacks.tableDefinition,
  checkoutSessions: checkoutSessions.tableDefinition,
  citations: citations.tableDefinition,
  claims: claims.tableDefinition,
  commerceRevocations: commerceRevocations.tableDefinition,
  concepts: concepts.tableDefinition,
  contextPacks: contextPacks.tableDefinition,
  creditLedger: creditLedger.tableDefinition,
  documentAnnotations: documentAnnotations.tableDefinition,
  documentVersions: documentVersions.tableDefinition,
  documents: documents.tableDefinition,
  dsarRequests: dsarRequests.tableDefinition,
  emailVerificationChallenges: emailVerificationChallenges.tableDefinition,
  entitlements: entitlements.tableDefinition,
  evaluationAnswers: evaluationAnswers.tableDefinition,
  evaluationReportVersions: evaluationReportVersions.tableDefinition,
  evaluationReports: evaluationReports.tableDefinition,
  evaluationSessions: evaluationSessions.tableDefinition,
  evaluationShares: evaluationShares.tableDefinition,
  featureFlagPolicies: featureFlagPolicies.tableDefinition,
  invitations: invitations.tableDefinition,
  maestroCredits: maestroCredits.tableDefinition,
  modelReceipts: modelReceipts.tableDefinition,
  notificationPreferences: notificationPreferences.tableDefinition,
  notificationRecords: notificationRecords.tableDefinition,
  organizationMembers: organizationMembers.tableDefinition,
  organizations: organizations.tableDefinition,
  policies: policies.tableDefinition,
  promptRegistry: promptRegistry.tableDefinition,
  purchases: purchases.tableDefinition,
  reportOwnerships: reportOwnerships.tableDefinition,
  supportIncidents: supportIncidents.tableDefinition,
  transformBlocks: transformBlocks.tableDefinition,
  transformDefinitions: transformDefinitions.tableDefinition,
  transformRuns: transformRuns.tableDefinition,
  usageEvents: usageEvents.tableDefinition,
  users: users.tableDefinition,
  versionFreshness: versionFreshness.tableDefinition,
  versionedEntries: versionedEntries.tableDefinition,
  webhookEvents: webhookEvents.tableDefinition,
  workflowRunContextManifests: workflowRunContextManifests.tableDefinition,
  workflowRunEvents: workflowRunEvents.tableDefinition,
  workflowRunEvidenceSnapshots: workflowRunEvidenceSnapshots.tableDefinition,
  workflowRunLinks: workflowRunLinks.tableDefinition,
  workflowRuns: workflowRuns.tableDefinition,
  workflowStageRuns: workflowStageRuns.tableDefinition,
  workspaceMembers: workspaceMembers.tableDefinition,
  workspaces: workspaces.tableDefinition,
});
