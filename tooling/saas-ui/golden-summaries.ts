import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { SaasUiDeviation } from "../quality/saas-ui-foundation";

const ABSOLUTE_PATH = /(?:^|[\s"':=])\/(?!\/)[^\s"`]+/u;

export const SUMMARY_NAMES = [
  "acceptance-summary.json",
  "deviation-summary.json",
  "interaction-summary.json",
  "accessibility-summary.json",
] as const;

export const REQUIRED_GOLDEN_COMMANDS = [
  "pnpm check:saas-ui-foundation",
  "pnpm check:saas-ui-artifact-safety",
  "pnpm --dir tooling/generators test -- saasFrontendFoundation.test.ts saasFrontendGeneratedTarget.test.ts",
  "pnpm smoke:golden:browser",
  "pnpm smoke:golden:a11y",
  "pnpm smoke:golden:visual",
] as const;

export type Pins = Readonly<{
  template: string;
  starter: string;
  pro: string;
}>;

export type GoldenCommandResult = Readonly<{
  command: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode: number;
  completedAt: string;
  result?: string;
}>;

export type GoldenRunReceipt = Readonly<{
  schemaVersion: 2;
  createdBy: "saas-ui:golden-summary-runner";
  startedAt: string;
  finishedAt: string;
  generatedAt: string;
  finalHead: string;
  pins: Pins;
  generatedDigest: string;
  deviations: readonly SaasUiDeviation[];
  evidencePaths: readonly string[];
  commands: readonly GoldenCommandResult[];
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

// eslint-disable-next-line complexity -- each branch closes one filesystem trust-boundary case.
function assertFreshEvidence(
  repositoryRoot: string,
  evidencePaths: readonly string[],
  startedAt: string,
  finishedAt: string,
): void {
  const root = realpathSync(repositoryRoot);
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (
    !Number.isFinite(started) ||
    !Number.isFinite(finished) ||
    started > finished
  )
    throw new Error("Golden run receipt timestamps are invalid");
  for (const relativePath of evidencePaths) {
    const path = resolve(repositoryRoot, relativePath);
    let realPath: string;
    try {
      realPath = realpathSync(path);
    } catch {
      throw new Error(`Golden evidence path does not exist: ${relativePath}`);
    }
    if (realPath !== root && relative(root, realPath).startsWith(".."))
      throw new Error(
        `Golden evidence path escapes repository: ${relativePath}`,
      );
    const stat = statSync(realPath);
    if (
      !stat.isFile() ||
      stat.mtimeMs < started ||
      stat.mtimeMs > finished + 1000
    )
      throw new Error(
        `Golden evidence path is not fresh for the recorded run: ${relativePath}`,
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
    if (command.startedAt !== undefined)
      assertSafeMetadata(command.startedAt, "command.startedAt");
    if (command.finishedAt !== undefined)
      assertSafeMetadata(command.finishedAt, "command.finishedAt");
    if (command.result !== undefined)
      assertSafeMetadata(command.result, "command.result");
  }
  for (const deviation of input.deviations)
    for (const value of Object.values(deviation))
      assertSafeMetadata(value, "deviation");
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readJson(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(value)) throw new Error(`JSON object required: ${path}`);
  return value;
}

function exactPins(value: unknown): Pins {
  if (!isRecord(value)) throw new Error("Saas UI upstream pins are missing");
  const pins = {
    template: value.template,
    starter: value.starter,
    pro: value.pro,
  };
  if (Object.values(pins).some((pin) => typeof pin !== "string"))
    throw new Error("Saas UI upstream pins are malformed");
  return pins as Pins;
}

function exactHead(repositoryRoot: string): string {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(head))
    throw new Error("Current git HEAD is not an exact commit SHA");
  return head;
}

// eslint-disable-next-line complexity -- each branch closes one receipt authority field.
function assertReceiptMetadata(
  receipt: GoldenRunReceipt,
  expected: { finalHead: string; pins: Pins; generatedDigest: string },
): void {
  if (
    receipt.schemaVersion !== 2 ||
    receipt.createdBy !== "saas-ui:golden-summary-runner"
  )
    throw new Error(
      "Golden run receipt must be machine-created schemaVersion 2",
    );
  if (receipt.finalHead !== expected.finalHead)
    throw new Error(
      "Golden run receipt is stale: finalHead does not match HEAD",
    );
  if (
    receipt.pins?.template !== expected.pins.template ||
    receipt.pins?.starter !== expected.pins.starter ||
    receipt.pins?.pro !== expected.pins.pro
  )
    throw new Error("Golden run receipt pins do not match the manifest");
  if (receipt.generatedDigest !== expected.generatedDigest)
    throw new Error(
      "Golden run receipt generated digest does not match the authority",
    );
}

// eslint-disable-next-line complexity -- each branch rejects one malformed machine receipt field.
function assertCommandResult(command: unknown): void {
  if (
    !isRecord(command) ||
    typeof command.command !== "string" ||
    command.command.length === 0 ||
    !Number.isInteger(command.exitCode) ||
    Number(command.exitCode) < 0
  )
    throw new Error("Golden run receipt command results are incomplete");
  if (
    typeof command.startedAt !== "string" ||
    typeof command.finishedAt !== "string" ||
    Date.parse(command.startedAt) > Date.parse(command.finishedAt) ||
    typeof command.completedAt !== "string" ||
    command.completedAt.length === 0 ||
    Number.isNaN(Date.parse(command.completedAt))
  )
    throw new Error("Golden run receipt command timestamp is invalid");
}

// eslint-disable-next-line complexity -- bounded validation of the fixed receipt contract.
function assertExecutableReceipt(receipt: GoldenRunReceipt): void {
  if (Date.parse(receipt.startedAt) > Date.parse(receipt.finishedAt))
    throw new Error("Golden run receipt timestamps are invalid");
  if (!receipt.generatedAt || Number.isNaN(Date.parse(receipt.generatedAt)))
    throw new Error("Golden run receipt generatedAt is missing or invalid");
  if (
    !Array.isArray(receipt.evidencePaths) ||
    receipt.evidencePaths.length === 0
  )
    throw new Error("Golden run receipt must include evidence paths");
  if (!Array.isArray(receipt.commands) || receipt.commands.length === 0)
    throw new Error("Golden run receipt must include command results");
  for (const command of receipt.commands) assertCommandResult(command);
  if (
    receipt.commands.length !== REQUIRED_GOLDEN_COMMANDS.length ||
    receipt.commands.some(
      (command, index) => command.command !== REQUIRED_GOLDEN_COMMANDS[index],
    )
  )
    throw new Error(
      "Golden run receipt command inventory is incomplete or altered",
    );
}

export function readGoldenRunReceipt(path: string): GoldenRunReceipt {
  const value = readJson(path);
  return value as unknown as GoldenRunReceipt;
}

export function buildGoldenSummaryInput(input: {
  repositoryRoot: string;
  receipt?: GoldenRunReceipt;
  generatedAt?: string;
  evidencePaths?: readonly string[];
  commands?: readonly GoldenCommandResult[];
  deviations?: readonly SaasUiDeviation[];
}): GoldenSummaryInput {
  const repositoryRoot = resolve(input.repositoryRoot);
  const finalHead = exactHead(repositoryRoot);
  const upstream = readJson(
    join(repositoryRoot, "docs/template/saas-ui-upstream.json"),
  );
  const pins = exactPins(upstream.pins);
  const authority = readJson(
    join(repositoryRoot, "artifacts/saas-ui-golden/authority-generated.json"),
  );
  if (
    authority.authority !== "generated" ||
    typeof authority.digest !== "string"
  )
    throw new Error("Generated golden authority digest is missing");

  let receipt = input.receipt;
  if (receipt === undefined) {
    if (
      !input.generatedAt ||
      input.evidencePaths === undefined ||
      input.commands === undefined
    )
      throw new Error(
        "Golden summaries require a run receipt or explicit generatedAt, evidencePaths, and command results",
      );
    receipt = {
      schemaVersion: 1,
      generatedAt: input.generatedAt,
      finalHead,
      pins,
      generatedDigest: authority.digest,
      deviations: input.deviations ?? [],
      evidencePaths: input.evidencePaths,
      commands: input.commands,
    };
  }
  assertReceiptMetadata(receipt, {
    finalHead,
    pins,
    generatedDigest: authority.digest,
  });
  assertExecutableReceipt(receipt);
  assertFreshEvidence(
    repositoryRoot,
    receipt.evidencePaths,
    receipt.startedAt,
    receipt.finishedAt,
  );
  return {
    generatedAt: receipt.generatedAt,
    finalHead,
    pins,
    generatedDigest: authority.digest,
    deviations: receipt.deviations,
    evidencePaths: receipt.evidencePaths,
    commands: receipt.commands,
  };
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
