export type MigrationVersionRelation =
  "immediate-prior" | "unknown" | "older" | "skipped" | "newer";

export type MigrationCounts = {
  readonly scanned: number;
  readonly eligible: number;
  readonly alreadyCompatible: number;
};

export type MigrationRecoveryV1 =
  | {
      readonly kind: "rollback";
      readonly operatorCommand: string;
      readonly evidenceRequirement: string;
    }
  | {
      readonly kind: "roll-forward-only";
      readonly reason: string;
      readonly operatorCommand: string;
      readonly approvalEvidenceRef?: string;
      readonly backupOrExportEvidenceRef?: string;
      readonly rollForwardPlan?: string;
    };

export type MigrationReceiptV1 = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly transitionId: string;
  readonly migrationId: string;
  readonly migrationFingerprint: string;
  readonly releaseRootCommit: string;
  readonly releaseManifestHash: string;
  readonly migrationManifestHash: string;
  readonly fileUpgradePlanFingerprint: string;
  readonly status: "completed";
  readonly completedAt: string;
  readonly issuer: { readonly id: string; readonly keyId: string };
  readonly replayIdentity: string;
  readonly authorization: {
    readonly approved: boolean;
    readonly evidenceRef: string;
  };
  readonly previewCounts: MigrationCounts;
  readonly migrateCounts: {
    readonly attempted: number;
    readonly succeeded: number;
    readonly failed: number;
  };
  readonly evidence: readonly {
    readonly id: string;
    readonly evidenceRef: string;
  }[];
  readonly signature: {
    readonly algorithm: "ed25519";
    readonly value: string;
  };
};
export type MigrationPlanInputV1 = {
  readonly schemaVersion: 1;
  readonly transition: {
    readonly id: string;
    readonly fromVersion: string;
    readonly toVersion: string;
    readonly immediatePriorVersion: string;
  };
  readonly target: {
    readonly version: string;
    readonly relation: MigrationVersionRelation;
  };
  readonly phases: readonly [
    { readonly kind: "expand"; readonly evidenceRef: string },
    {
      readonly kind: "backward-compatible-code";
      readonly evidenceRef: string;
    },
  ];
  readonly migration: {
    readonly id: string;
    readonly irreversible: boolean;
    readonly operatorCommand: string;
    readonly previewCounts: MigrationCounts;
    readonly migrateCounts: { readonly planned: number };
    readonly compatibilityWindow: {
      readonly startsAt: string;
      readonly endsAt: string;
      readonly contractNotBefore: string;
    };
    readonly evidenceRequirements: readonly {
      readonly id: string;
      readonly detail: string;
    }[];
    readonly recovery: MigrationRecoveryV1;
  };
  readonly receipt?: MigrationReceiptV1;
};

export type MigrationBlockerCode =
  | "MIGRATION_INPUT_INVALID"
  | "MIGRATION_SOURCE_UNKNOWN"
  | "MIGRATION_SOURCE_OLDER"
  | "MIGRATION_SOURCE_SKIPPED"
  | "MIGRATION_SOURCE_NEWER"
  | "MIGRATION_SOURCE_MISMATCH"
  | "MIGRATION_PHASE_ORDER_INVALID"
  | "MIGRATION_COUNTS_INVALID"
  | "MIGRATION_COMPATIBILITY_WINDOW_INVALID"
  | "MIGRATION_IRREVERSIBLE_UNSAFE"
  | "MIGRATION_RECEIPT_STALE"
  | "MIGRATION_RECEIPT_TAMPERED"
  | "MIGRATION_RECEIPT_UNAUTHORIZED"
  | "MIGRATION_RECEIPT_EVIDENCE_MISSING"
  | "MIGRATION_RECEIPT_AUTHORITY_REQUIRED"
  | "MIGRATION_RECEIPT_ISSUER_UNTRUSTED"
  | "MIGRATION_RECEIPT_SIGNATURE_INVALID"
  | "MIGRATION_RECEIPT_REPLAYED";

export type MigrationResolution = {
  readonly code: MigrationBlockerCode;
  readonly message: string;
  readonly repair: string;
};

export type MigrationPlanResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly executionAvailable: false;
      readonly transitionId: string;
      readonly migrationId: string;
      readonly migrationFingerprint: string;
      readonly steps: readonly {
        readonly kind:
          | "expand"
          | "backward-compatible-code"
          | "preview"
          | "migrate"
          | "compatibility-window"
          | "contract";
      }[];
      readonly operatorCommand: string;
      readonly previewCounts: MigrationCounts;
      readonly migrateCounts: { readonly planned: number };
      readonly compatibilityWindow: MigrationPlanInputV1["migration"]["compatibilityWindow"];
      readonly evidenceRequirements: MigrationPlanInputV1["migration"]["evidenceRequirements"];
      readonly recovery: MigrationRecoveryV1;
      readonly fileUpgrade: {
        readonly blocked: true;
        readonly code: "MIGRATION_RECEIPT_REQUIRED";
      };
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly executionAvailable: false;
      readonly resolutions: readonly MigrationResolution[];
    };
