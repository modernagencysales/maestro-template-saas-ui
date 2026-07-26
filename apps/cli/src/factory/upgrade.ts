import {
  applyRepositoryUpgrade,
  planRepositoryUpgrade,
  rollbackRepositoryUpgrade,
  verifyRepositoryUpgrade,
} from "@maestro-template/release-tooling/upgrade";
import {
  planMigrationHandoff,
  verifyMigrationHandoff,
} from "@maestro-template/release-tooling/migration";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
const inputJson = (cwd: string, argv: readonly string[]): unknown => {
  const input = valueAfter(argv, "--input");
  if (!input)
    throw new Error(
      "upgrade migration-plan/migration-verify requires --input.",
    );
  return JSON.parse(readFileSync(resolve(cwd, input), "utf8")) as unknown;
};

export const createUpgradeCliHandler = (): FactoryCliHandler => ({
  command: "upgrade",
  run: async (argv, cwd) => {
    try {
      const action = argv[1];
      if (action === "migration-plan") {
        const result = planMigrationHandoff(inputJson(cwd, argv));
        return result.ok
          ? success(result)
          : { ...success(result), exitCode: 1 };
      }
      if (action === "migration-verify") {
        const result = verifyMigrationHandoff(inputJson(cwd, argv));
        return result.ok
          ? success(result)
          : { ...success(result), exitCode: 1 };
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
