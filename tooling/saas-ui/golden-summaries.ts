import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { SaasUiDeviation } from "../quality/saas-ui-foundation";

const ABSOLUTE_PATH = /(?:^|[\s"':=])\/(?!\/)[^\s"`]+/u;

const SUMMARY_NAMES = [
  "acceptance-summary.json",
  "deviation-summary.json",
  "interaction-summary.json",
  "accessibility-summary.json",
] as const;

type Pins = Readonly<{
  template: string;
  starter: string;
  pro: string;
}>;

export type GoldenCommandResult = Readonly<{
  command: string;
  exitCode: number;
  completedAt: string;
}>;

export type GoldenSummaryInput = Readonly<{
  generatedAt: string;
  finalHead: string;
  pins: Pins;
  generatedDigest: string;
  deviations: readonly SaasUiDeviation[];
  evidencePaths: readonly string[];
  commands: readonly GoldenCommandResult[];
}>;

function assertSafeMetadata(value: string, label: string): void {
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    ABSOLUTE_PATH.test(value)
  ) {
    throw new Error(`${label} must not contain an absolute or temporary path`);
  }
}

function assertEvidencePath(value: string): void {
  assertSafeMetadata(value, "evidence path");
  if (
    !value.startsWith("artifacts/saas-ui-golden/") ||
    value.split("/").some((part) => part === "..")
  ) {
    throw new Error(
      `evidence path must be repository-relative under artifacts/saas-ui-golden/: ${value}`,
    );
  }
}

function statusFor(commands: readonly GoldenCommandResult[]) {
  if (commands.length === 0) return "pending" as const;
  return commands.every(({ exitCode }) => exitCode === 0)
    ? ("passed" as const)
    : ("failed" as const);
}

function validateInput(input: GoldenSummaryInput): void {
  assertSafeMetadata(input.generatedAt, "generatedAt");
  assertSafeMetadata(input.finalHead, "finalHead");
  assertSafeMetadata(input.generatedDigest, "generatedDigest");
  for (const value of Object.values(input.pins))
    assertSafeMetadata(value, "pin");
  for (const path of input.evidencePaths) assertEvidencePath(path);
  for (const command of input.commands) {
    assertSafeMetadata(command.command, "command");
    assertSafeMetadata(command.completedAt, "command.completedAt");
  }
  for (const deviation of input.deviations)
    for (const value of Object.values(deviation))
      assertSafeMetadata(value, "deviation");
}

export function writeGoldenSummaries(
  outputRoot: string,
  input: GoldenSummaryInput,
): void {
  validateInput(input);
  const shared = {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    status: statusFor(input.commands),
    finalHead: input.finalHead,
    pins: input.pins,
    generatedDigest: input.generatedDigest,
    evidencePaths: input.evidencePaths,
    commands: input.commands,
  } as const;

  for (const name of SUMMARY_NAMES) {
    const summary = {
      ...shared,
      kind: name.replace("-summary.json", ""),
      ...(name === "deviation-summary.json"
        ? {
            deviationCount: input.deviations.length,
            deviations: input.deviations,
          }
        : {}),
    };
    const path = join(outputRoot, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`);
  }
}
