import * as Schema from "effect/Schema";
import {
  currentLifecycleResourceIds,
  workspaceLifecycleResourcePlans,
  workspaceRetentionRules,
} from "./dataResources.generated";

export { currentLifecycleResourceIds } from "./dataResources.generated";

export type LifecycleResourceId = (typeof currentLifecycleResourceIds)[number];

export const LifecycleResourceIdSchema = Schema.Literals(
  currentLifecycleResourceIds,
);

export type LifecycleResourcePlan = {
  readonly id: LifecycleResourceId;
  readonly owner: "workspace";
  readonly exportMode: "markdown" | "json" | "redacted-json";
  readonly deleteMode: "delete" | "redact" | "retain-audit";
  readonly detail: string;
};

export type RetentionRule = {
  readonly resourceId: LifecycleResourceId;
  readonly action:
    | "retain-until-workspace-delete"
    | "retain-audit-window"
    | "hash-or-redact-on-export";
  readonly detail: string;
};

export type WorkspaceDataLifecyclePlan = {
  readonly workspaceId: string;
  readonly requestedBy: string;
  readonly plannedAt: number;
  readonly export: {
    readonly resources: readonly LifecycleResourcePlan[];
  };
  readonly delete: {
    readonly confirmation: {
      readonly required: true;
      readonly phrase: string;
      readonly reason: string;
    };
    readonly resources: readonly LifecycleResourcePlan[];
  };
  readonly retention: {
    readonly rules: readonly RetentionRule[];
  };
};

export type DsarRequestKind = "export" | "delete";

export const DsarRequestKindSchema = Schema.Literals(["export", "delete"]);

export type DsarRequestStatus =
  "ready-for-review" | "needs-confirmation" | "blocked-by-legal-hold";

export const DsarRequestStatusSchema = Schema.Literals([
  "ready-for-review",
  "needs-confirmation",
  "blocked-by-legal-hold",
]);

export type LegalHold = {
  readonly enabled: boolean;
  readonly reason: string;
  readonly expiresAt?: number | undefined;
};

export const LegalHoldSchema = Schema.Struct({
  enabled: Schema.Boolean,
  reason: Schema.String,
  expiresAt: Schema.optional(Schema.Number),
});

export type DsarExportManifestEntry = {
  readonly resourceId: LifecycleResourceId;
  readonly exportMode: LifecycleResourcePlan["exportMode"];
  readonly detail: string;
};

export const DsarExportManifestEntrySchema = Schema.Struct({
  resourceId: LifecycleResourceIdSchema,
  exportMode: Schema.Literals(["markdown", "json", "redacted-json"]),
  detail: Schema.String,
});

export type DsarDeletePlanEntry = {
  readonly resourceId: LifecycleResourceId;
  readonly deleteMode: LifecycleResourcePlan["deleteMode"];
  readonly executable: false;
  readonly reason: string;
};

export const DsarDeletePlanEntrySchema = Schema.Struct({
  resourceId: LifecycleResourceIdSchema,
  deleteMode: Schema.Literals(["delete", "redact", "retain-audit"]),
  executable: Schema.Literal(false),
  reason: Schema.String,
});

export type WorkspaceDsarPlan = {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly requestedBy: string;
  readonly subjectId?: string;
  readonly kind: DsarRequestKind;
  readonly plannedAt: number;
  readonly status: DsarRequestStatus;
  readonly dryRunOnly: true;
  readonly legalHold?: LegalHold;
  readonly confirmation: WorkspaceDataLifecyclePlan["delete"]["confirmation"];
  readonly exportManifest: readonly DsarExportManifestEntry[];
  readonly deletePlan: readonly DsarDeletePlanEntry[];
};

export type RetentionJobPlan = {
  readonly workspaceId: string;
  readonly plannedAt: number;
  readonly dryRunOnly: true;
  readonly auditWindowDays: number;
  readonly legalHold?: LegalHold;
  readonly nextReviewAt: number;
  readonly actions: readonly {
    readonly resourceId: LifecycleResourceId;
    readonly action: RetentionRule["action"];
    readonly executable: false;
    readonly reason: string;
  }[];
};

export const buildWorkspaceDataLifecyclePlan = (input: {
  readonly workspaceId: string;
  readonly requestedBy: string;
  readonly now: number;
}): WorkspaceDataLifecyclePlan => ({
  workspaceId: input.workspaceId,
  requestedBy: input.requestedBy,
  plannedAt: input.now,
  export: {
    resources: workspaceLifecycleResourcePlans,
  },
  delete: {
    confirmation: {
      required: true,
      phrase: `delete ${input.workspaceId}`,
      reason: "workspace data deletion is destructive and audited",
    },
    resources: workspaceLifecycleResourcePlans,
  },
  retention: {
    rules: workspaceRetentionRules,
  },
});

const deleteReasonFor = ({
  confirmed,
  legalHold,
  resource,
}: {
  readonly confirmed: boolean;
  readonly legalHold?: LegalHold;
  readonly resource: LifecycleResourcePlan;
}): string => {
  if (legalHold?.enabled) {
    return `Blocked by legal hold: ${legalHold.reason}`;
  }

  if (!confirmed) {
    return "Awaiting exact workspace delete confirmation.";
  }

  return `Plan-only ${resource.deleteMode} action; forks must wire audited mutations before execution.`;
};

export const buildWorkspaceDsarPlan = (input: {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly requestedBy: string;
  readonly subjectId?: string;
  readonly kind: DsarRequestKind;
  readonly now: number;
  readonly confirmationPhrase?: string;
  readonly legalHold?: LegalHold;
}): WorkspaceDsarPlan => {
  const lifecycle = buildWorkspaceDataLifecyclePlan({
    workspaceId: input.workspaceId,
    requestedBy: input.requestedBy,
    now: input.now,
  });
  const confirmed =
    input.confirmationPhrase === lifecycle.delete.confirmation.phrase;
  const status: DsarRequestStatus = input.legalHold?.enabled
    ? "blocked-by-legal-hold"
    : input.kind === "delete" && !confirmed
      ? "needs-confirmation"
      : "ready-for-review";
  const exportManifest = lifecycle.export.resources.map((resource) => ({
    resourceId: resource.id,
    exportMode: resource.exportMode,
    detail: resource.detail,
  }));
  const deletePlan = lifecycle.delete.resources.map((resource) => ({
    resourceId: resource.id,
    deleteMode: resource.deleteMode,
    executable: false as const,
    reason: deleteReasonFor({
      confirmed,
      ...(input.legalHold === undefined ? {} : { legalHold: input.legalHold }),
      resource,
    }),
  }));

  return {
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    requestedBy: input.requestedBy,
    ...(input.subjectId === undefined ? {} : { subjectId: input.subjectId }),
    kind: input.kind,
    plannedAt: input.now,
    status,
    dryRunOnly: true,
    ...(input.legalHold === undefined ? {} : { legalHold: input.legalHold }),
    confirmation: lifecycle.delete.confirmation,
    exportManifest,
    deletePlan,
  };
};

export const buildRetentionJobPlan = (input: {
  readonly workspaceId: string;
  readonly requestedBy: string;
  readonly now: number;
  readonly auditWindowDays: number;
  readonly legalHold?: LegalHold;
}): RetentionJobPlan => {
  const lifecycle = buildWorkspaceDataLifecyclePlan({
    workspaceId: input.workspaceId,
    requestedBy: input.requestedBy,
    now: input.now,
  });
  const dayMs = 24 * 60 * 60 * 1_000;

  return {
    workspaceId: input.workspaceId,
    plannedAt: input.now,
    dryRunOnly: true,
    auditWindowDays: input.auditWindowDays,
    ...(input.legalHold === undefined ? {} : { legalHold: input.legalHold }),
    nextReviewAt: input.now + dayMs,
    actions: lifecycle.retention.rules.map((rule) => ({
      resourceId: rule.resourceId,
      action: rule.action,
      executable: false as const,
      reason: input.legalHold?.enabled
        ? `Blocked by legal hold: ${input.legalHold.reason}`
        : `${rule.detail} Retention job is plan-only until a fork wires audited cron execution.`,
    })),
  };
};
