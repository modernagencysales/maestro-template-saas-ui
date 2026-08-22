export const UPGRADE_OPERATION_KINDS = [
  "add",
  "modify",
  "move",
  "delete",
  "regenerate",
] as const;

export type UpgradeOperationKind = (typeof UPGRADE_OPERATION_KINDS)[number];
export type UpgradeOwnership = "template-owned" | "generated";
export type TargetPathOwnership = UpgradeOwnership | "customer-owned";
export type UpgradeVersionRelation =
  "immediate-prior" | "older" | "skipped" | "newer";
export type UpgradeRequirementKind =
  "manual-review" | "data-migration" | "provider-change" | "environment-change";

export type UpgradeOperationV1 = {
  readonly id: string;
  readonly kind: UpgradeOperationKind;
  readonly path: string;
  readonly fromPath?: string;
  readonly ownership: UpgradeOwnership;
  readonly beforeHash?: string;
  readonly afterHash?: string;
};

export type UpgradeManifestV1 = {
  readonly schemaVersion: 1;
  readonly transition: {
    readonly id: string;
    readonly fromVersion: string;
    readonly toVersion: string;
    readonly immediatePriorVersion: string;
  };
  readonly operations: readonly UpgradeOperationV1[];
  readonly requirements: readonly {
    readonly id: string;
    readonly kind: UpgradeRequirementKind;
    readonly detail: string;
  }[];
};

export type UpgradeTargetV1 = {
  readonly version: string;
  readonly relation: UpgradeVersionRelation;
  readonly commit: string;
  readonly clean: boolean;
  readonly files: readonly {
    readonly path: string;
    readonly ownership: TargetPathOwnership;
    readonly hash: string;
  }[];
};

export type UpgradePlanInputV1 = {
  readonly schemaVersion: 1;
  readonly manifest: UpgradeManifestV1;
  readonly target: UpgradeTargetV1;
};

export type UpgradeBlockerCode =
  | "UPGRADE_INPUT_INVALID"
  | "UPGRADE_SOURCE_OLDER"
  | "UPGRADE_SOURCE_SKIPPED"
  | "UPGRADE_SOURCE_NEWER"
  | "UPGRADE_SOURCE_MISMATCH"
  | "UPGRADE_TARGET_DIRTY"
  | "UPGRADE_CUSTOMER_OVERLAP"
  | "UPGRADE_UNEXPECTED_PATH"
  | "UPGRADE_PATH_MISSING"
  | "UPGRADE_HASH_MISMATCH"
  | "UPGRADE_OWNERSHIP_MISMATCH"
  | "UPGRADE_MOVE_AMBIGUOUS"
  | "UPGRADE_MANUAL_REVIEW"
  | "UPGRADE_DATA_MIGRATION"
  | "UPGRADE_PROVIDER_CHANGE"
  | "UPGRADE_ENVIRONMENT_CHANGE";

export type UpgradeResolution = {
  readonly code: UpgradeBlockerCode;
  readonly operationId?: string;
  readonly path?: string;
  readonly message: string;
  readonly repair: string;
};

export type UpgradeDiffEntry = {
  readonly operationId: string;
  readonly kind: UpgradeOperationKind;
  readonly classification:
    | "add-template"
    | "modify-template"
    | "move-template"
    | "delete-template"
    | "regenerate-generated";
  readonly path: string;
  readonly fromPath?: string;
  readonly beforeHash?: string;
  readonly afterHash?: string;
};

export type UpgradePlanResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly writeAvailable: false;
      readonly transitionId: string;
      readonly manifestFingerprint: string;
      readonly planFingerprint: string;
      readonly targetCommit: string;
      readonly targetClean: boolean;
      readonly diff: readonly UpgradeDiffEntry[];
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "plan-only";
      readonly writeAvailable: false;
      readonly resolutions: readonly UpgradeResolution[];
    };
