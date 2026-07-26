export type MigrationVerificationCode =
  | "MIGRATION_VERIFY_INPUT_INVALID"
  | "MIGRATION_VERIFY_TRUSTED_AUTHORITY_REQUIRED"
  | "MIGRATION_VERIFY_RECEIPT_REQUIRED"
  | "MIGRATION_VERIFY_HANDOFF_INVALID"
  | "MIGRATION_VERIFY_FINGERPRINT_MISMATCH";

export type MigrationVerificationResult =
  | {
      readonly ok: true;
      readonly schemaVersion: 1;
      readonly mode: "verify-only";
      readonly writeAvailable: false;
      readonly fileUpgradePlanFingerprint: string;
      readonly receiptVerified: boolean;
      readonly migration:
        | { readonly required: false }
        | {
            readonly required: true;
            readonly migrationFingerprint: string;
            readonly receiptId: string;
          };
    }
  | {
      readonly ok: false;
      readonly schemaVersion: 1;
      readonly mode: "verify-only";
      readonly writeAvailable: false;
      readonly resolutions: readonly {
        readonly code: MigrationVerificationCode;
        readonly message: string;
        readonly repair: string;
        readonly handoffCodes?: readonly string[];
      }[];
    };

type ParsedVerification = {
  readonly fileUpgrade: {
    readonly planFingerprint: string;
    readonly dataMigrationRequired: boolean;
  };
  readonly migration?: {
    readonly expectedFingerprint: string;
    readonly handoff: unknown;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => Object.keys(value).every((key) => keys.includes(key));
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);

const parseVerification = (value: unknown): ParsedVerification | undefined => {
  if (
    !isRecord(value) ||
    !onlyKeys(value, ["schemaVersion", "fileUpgrade", "migration"]) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.fileUpgrade) ||
    !onlyKeys(value.fileUpgrade, [
      "planFingerprint",
      "dataMigrationRequired",
    ]) ||
    !digest(value.fileUpgrade.planFingerprint) ||
    typeof value.fileUpgrade.dataMigrationRequired !== "boolean"
  ) {
    return undefined;
  }
  if (value.migration === undefined) {
    return {
      fileUpgrade: {
        planFingerprint: value.fileUpgrade.planFingerprint,
        dataMigrationRequired: value.fileUpgrade.dataMigrationRequired,
      },
    };
  }
  if (
    !value.fileUpgrade.dataMigrationRequired ||
    !isRecord(value.migration) ||
    !onlyKeys(value.migration, ["expectedFingerprint", "handoff"]) ||
    !digest(value.migration.expectedFingerprint) ||
    !("handoff" in value.migration)
  ) {
    return undefined;
  }
  return {
    fileUpgrade: {
      planFingerprint: value.fileUpgrade.planFingerprint,
      dataMigrationRequired: true,
    },
    migration: {
      expectedFingerprint: value.migration.expectedFingerprint,
      handoff: value.migration.handoff,
    },
  };
};

const failure = (
  code: MigrationVerificationCode,
  message: string,
  repair: string,
  handoffCodes?: readonly string[],
): MigrationVerificationResult => ({
  ok: false,
  schemaVersion: 1,
  mode: "verify-only",
  writeAvailable: false,
  resolutions: [
    {
      code,
      message,
      repair,
      ...(handoffCodes ? { handoffCodes: [...handoffCodes] } : {}),
    },
  ],
});

export const verifyMigrationHandoff = (
  candidate: unknown,
): MigrationVerificationResult => {
  const input = parseVerification(candidate);
  if (!input) {
    return failure(
      "MIGRATION_VERIFY_INPUT_INVALID",
      "Migration verification input does not match the closed V1 contract.",
      "Regenerate verification input from the reviewed file-upgrade plan.",
    );
  }
  void input;
  return failure(
    "MIGRATION_VERIFY_TRUSTED_AUTHORITY_REQUIRED",
    "Caller-supplied migration flags, fingerprints, receipts, keys, and replay state are not trusted authority.",
    "Use a release-bound verifier with an out-of-band issuer root and durable atomic check-and-consume dependency.",
  );
};
