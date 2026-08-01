import { GenericId } from "@confect/core";

export type TableNames = "accessAuditEvents" | "actionApprovals" | "actionDigests" | "actionJobs" | "actionTriggers" | "apiKeys" | "billingPlans" | "brainPages" | "buildPackEntitlements" | "buildPackExports" | "buildPackStages" | "buildPacks" | "checkoutSessions" | "citations" | "claims" | "concepts" | "contextPacks" | "creditLedger" | "documentAnnotations" | "documentVersions" | "documents" | "dsarRequests" | "entitlements" | "evaluationAnswers" | "evaluationReportVersions" | "evaluationReports" | "evaluationSessions" | "evaluationShares" | "featureFlagPolicies" | "invitations" | "maestroCredits" | "notificationPreferences" | "notificationRecords" | "organizationMembers" | "organizations" | "policies" | "promptRegistry" | "purchases" | "supportIncidents" | "transformBlocks" | "transformDefinitions" | "transformRuns" | "usageEvents" | "users" | "versionFreshness" | "versionedEntries" | "webhookEvents" | "workflowRunContextManifests" | "workflowRunEvents" | "workflowRunEvidenceSnapshots" | "workflowRunLinks" | "workflowRuns" | "workflowStageRuns" | "workspaceMembers" | "workspaces";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
