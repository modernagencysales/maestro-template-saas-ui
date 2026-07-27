import {
  applyRepositoryUpgrade,
  planRepositoryUpgrade,
  rollbackRepositoryUpgrade,
  verifyRepositoryUpgrade,
} from "@maestro-template/release-tooling/upgrade";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { CliResult } from "../types";
import type { FactoryCliHandler } from "./router";

const valueAfter = (
  argv: readonly string[],
  flag: string,
): string | undefined => {
  const index = argv.indexOf(flag);
  return index < 0 ? undefined : argv[index + 1];
};
const success = (value: unknown): CliResult => ({
  exitCode: 0,
  stdout: `${JSON.stringify(value, null, 2)}\n`,
  stderr: "",
});
const failure = (error: unknown): CliResult => ({
  exitCode: 1,
  stdout: "",
  stderr: `${error instanceof Error ? error.message : "Upgrade command failed."}\n`,
});
export const readMigrationVerificationInput = (
  cwd: string,
  argv: readonly string[],
): unknown => {
  const input = valueAfter(argv, "--input");
  if (!input) throw new Error("upgrade migration-verify requires --input.");
  try {
    if (isAbsolute(input)) throw new Error("unsafe");
    const root = realpathSync(resolve(cwd));
    const absolute = resolve(root, input);
    const rel = relative(root, absolute);
    if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`))
      throw new Error("unsafe");
    let current = root;
    for (const part of rel.split(sep)) {
      current = resolve(current, part);
      if (lstatSync(current).isSymbolicLink()) throw new Error("unsafe");
    }
    const stat = statSync(absolute);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("unsafe");
    return JSON.parse(readFileSync(absolute, "utf8")) as unknown;
  } catch {
    throw new Error("Migration verification input could not be read.");
  }
};
const migrationAuthority = (cwd: string, argv: readonly string[]) => {
  const releaseRoot = valueAfter(argv, "--release-root");
  const toVersion = valueAfter(argv, "--to");
  if (!releaseRoot || !toVersion)
    throw new Error(
      "upgrade migration-plan/migration-verify requires --release-root and --to.",
    );
  return planRepositoryUpgrade({
    targetRoot: cwd,
    releaseRoot: resolve(cwd, releaseRoot),
    toVersion,
  });
};

export const createUpgradeCliHandler = (): FactoryCliHandler => ({
  command: "upgrade",
  run: async (argv, cwd) => {
    try {
      const action = argv[1];
      if (action === "migration-plan") {
        const trusted = migrationAuthority(cwd, argv);
        return success({
          ok: true,
          schemaVersion: 1,
          mode: "plan-only",
          ...trusted.migration,
          fileUpgrade: {
            blocked: trusted.migration.required,
            ...(trusted.migration.required
              ? { code: "MIGRATION_EXTERNAL_AUTHORITY_UNAVAILABLE" }
              : {}),
          },
        });
      }
      if (action === "migration-verify") {
        const trusted = migrationAuthority(cwd, argv);
        readMigrationVerificationInput(cwd, argv);
        return {
          ...success({
            ok: false,
            schemaVersion: 1,
            mode: "verify-only",
            writeAvailable: false,
            transitionId: trusted.migration.transitionId,
            fileUpgradePlanFingerprint:
              trusted.migration.fileUpgradePlanFingerprint,
            resolutions: [
              {
                code: "MIGRATION_EXTERNAL_AUTHORITY_UNAVAILABLE",
                message:
                  "No externally trusted receipt issuer or durable replay-consumption authority is configured.",
                repair:
                  "Configure the release-pinned issuer and durable receipt-consumption service before apply.",
              },
            ],
          }),
          exitCode: 1,
        };
      }
      if (action === "verify") {
        const receipt = valueAfter(argv, "--receipt");
        const targetRoot = valueAfter(argv, "--target-root");
        const fingerprint = valueAfter(argv, "--plan-fingerprint");
        const journalDigest = valueAfter(argv, "--journal-digest");
        if (!receipt || !targetRoot || !fingerprint || !journalDigest)
          throw new Error(
            "upgrade verify requires --receipt, --target-root, --plan-fingerprint, and --journal-digest.",
          );
        const result = verifyRepositoryUpgrade({
          receiptPath: resolve(cwd, receipt),
          targetRoot: resolve(cwd, targetRoot),
          expectedPlanFingerprint: fingerprint,
          expectedJournalDigest: journalDigest,
        });
        return result.ok
          ? success(result)
          : { ...success(result), exitCode: 1 };
      }
      if (action === "rollback") {
        const receipt = valueAfter(argv, "--receipt");
        const targetRoot = valueAfter(argv, "--target-root");
        const fingerprint = valueAfter(argv, "--plan-fingerprint");
        const journalDigest = valueAfter(argv, "--journal-digest");
        if (
          !receipt ||
          !targetRoot ||
          !fingerprint ||
          !journalDigest ||
          !argv.includes("--write")
        )
          throw new Error(
            "upgrade rollback requires --receipt, --target-root, --plan-fingerprint, --journal-digest, and --write.",
          );
        return success({
          rollbackReceiptPath: rollbackRepositoryUpgrade({
            receiptPath: resolve(cwd, receipt),
            targetRoot: resolve(cwd, targetRoot),
            expectedPlanFingerprint: fingerprint,
            expectedJournalDigest: journalDigest,
            write: true,
          }),
        });
      }
      if (action !== "plan" && action !== "apply-safe")
        throw new Error(
          "Usage: maestro upgrade plan|apply-safe|verify|rollback|migration-plan|migration-verify.",
        );
      const releaseRootValue = valueAfter(argv, "--release-root");
      const toVersion = valueAfter(argv, "--to");
      if (!toVersion || !releaseRootValue)
        throw new Error(
          "upgrade plan/apply-safe requires --release-root and --to.",
        );
      const trusted = planRepositoryUpgrade({
        targetRoot: cwd,
        releaseRoot: resolve(cwd, releaseRootValue),
        toVersion,
      });
      if (action === "plan") return success(trusted);
      const fingerprint = valueAfter(argv, "--plan-fingerprint");
      const authorityFingerprint = valueAfter(argv, "--authority-fingerprint");
      if (!fingerprint || !authorityFingerprint || !argv.includes("--write"))
        throw new Error(
          "upgrade apply-safe requires --plan-fingerprint, --authority-fingerprint, and --write.",
        );
      return success(
        applyRepositoryUpgrade({
          trusted,
          targetRoot: cwd,
          expectedPlanFingerprint: fingerprint,
          expectedAuthorityFingerprint: authorityFingerprint,
          write: true,
        }),
      );
    } catch (error) {
      return failure(error);
    }
  },
});
