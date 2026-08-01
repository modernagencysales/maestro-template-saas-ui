import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

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

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof accessAuditEvents |
  typeof actionApprovals |
  typeof actionDigests |
  typeof actionJobs |
  typeof actionTriggers |
  typeof apiKeys |
  typeof billingPlans |
  typeof brainPages |
  typeof buildPackEntitlements |
  typeof buildPackExports |
  typeof buildPackStages |
  typeof buildPacks |
  typeof checkoutSessions |
  typeof citations |
  typeof claims |
  typeof concepts |
  typeof contextPacks |
  typeof creditLedger |
  typeof documentAnnotations |
  typeof documentVersions |
  typeof documents |
  typeof dsarRequests |
  typeof emailVerificationChallenges |
  typeof entitlements |
  typeof evaluationAnswers |
  typeof evaluationReportVersions |
  typeof evaluationReports |
  typeof evaluationSessions |
  typeof evaluationShares |
  typeof featureFlagPolicies |
  typeof invitations |
  typeof maestroCredits |
  typeof notificationPreferences |
  typeof notificationRecords |
  typeof organizationMembers |
  typeof organizations |
  typeof policies |
  typeof promptRegistry |
  typeof purchases |
  typeof reportOwnerships |
  typeof supportIncidents |
  typeof transformBlocks |
  typeof transformDefinitions |
  typeof transformRuns |
  typeof usageEvents |
  typeof users |
  typeof versionFreshness |
  typeof versionedEntries |
  typeof webhookEvents |
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
  buildPackEntitlements,
  buildPackExports,
  buildPackStages,
  buildPacks,
  checkoutSessions,
  citations,
  claims,
  concepts,
  contextPacks,
  creditLedger,
  documentAnnotations,
  documentVersions,
  documents,
  dsarRequests,
  emailVerificationChallenges,
  entitlements,
  evaluationAnswers,
  evaluationReportVersions,
  evaluationReports,
  evaluationSessions,
  evaluationShares,
  featureFlagPolicies,
  invitations,
  maestroCredits,
  notificationPreferences,
  notificationRecords,
  organizationMembers,
  organizations,
  policies,
  promptRegistry,
  purchases,
  reportOwnerships,
  supportIncidents,
  transformBlocks,
  transformDefinitions,
  transformRuns,
  usageEvents,
  users,
  versionFreshness,
  versionedEntries,
  webhookEvents,
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
