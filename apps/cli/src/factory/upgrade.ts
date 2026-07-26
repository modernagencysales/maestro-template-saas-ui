import {
  applyRepositoryUpgrade,
  planRepositoryUpgrade,
  rollbackRepositoryUpgrade,
  verifyRepositoryUpgrade,
} from "@maestro-template/release-tooling/upgrade";
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

export const createUpgradeCliHandler = (): FactoryCliHandler => ({
  command: "upgrade",
  run: async (argv, cwd) => {
    try {
      const action = argv[1];
      if (action === "verify") {
        const receipt = valueAfter(argv, "--receipt");
        if (!receipt)
          throw new Error("upgrade verify requires --receipt <path>.");
        const result = verifyRepositoryUpgrade(resolve(cwd, receipt));
        return result.ok
          ? success(result)
          : { ...success(result), exitCode: 1 };
      }
      if (action === "rollback") {
        const receipt = valueAfter(argv, "--receipt");
        if (!receipt)
          throw new Error("upgrade rollback requires --receipt <path>.");
        return success({
          rollbackReceiptPath: rollbackRepositoryUpgrade(resolve(cwd, receipt)),
        });
      }
      if (action !== "plan" && action !== "apply-safe")
        throw new Error(
          "Usage: maestro upgrade plan|apply-safe|verify|rollback.",
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
      if (!fingerprint || !argv.includes("--write"))
        throw new Error(
          "upgrade apply-safe requires --plan-fingerprint and --write.",
        );
      return success(
        applyRepositoryUpgrade({
          trusted,
          targetRoot: cwd,
          expectedPlanFingerprint: fingerprint,
          write: true,
        }),
      );
    } catch (error) {
      return failure(error);
    }
  },
});
