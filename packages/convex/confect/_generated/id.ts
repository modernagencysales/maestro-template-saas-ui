import { GenericId } from "@confect/core";

export type TableNames = "accessAuditEvents" | "actionApprovals" | "actionDigests" | "actionJobs" | "actionTriggers" | "apiKeys" | "billingPlans" | "brainPages" | "citations" | "claims" | "concepts" | "contextPacks" | "creditLedger" | "documentAnnotations" | "documentVersions" | "documents" | "dsarRequests" | "entitlements" | "featureFlagPolicies" | "invitations" | "notificationPreferences" | "notificationRecords" | "organizationMembers" | "organizations" | "policies" | "promptRegistry" | "transformBlocks" | "transformDefinitions" | "transformRuns" | "usageEvents" | "users" | "versionFreshness" | "versionedEntries" | "webhookEvents" | "workflowEffectReservations" | "workflowRunContextManifests" | "workflowRunEvents" | "workflowRunEvidenceSnapshots" | "workflowRunLinks" | "workflowRuns" | "workflowStageRuns" | "workspaceMembers" | "workspaces";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
