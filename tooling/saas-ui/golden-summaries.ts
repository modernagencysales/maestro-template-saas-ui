import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  lstatSync,
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
  startedAt: string;
  finishedAt: string;
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

export type GoldenCommandExecutor = (input: {
  command: string;
  argv: readonly string[];
  cwd: string;
}) => number;

const commandArgv = (command: (typeof REQUIRED_GOLDEN_COMMANDS)[number]) => {
  switch (command) {
    case "pnpm check:saas-ui-foundation":
      return ["check:saas-ui-foundation"];
    case "pnpm check:saas-ui-artifact-safety":
      return ["check:saas-ui-artifact-safety"];
    case "pnpm --dir tooling/generators test -- saasFrontendFoundation.test.ts saasFrontendGeneratedTarget.test.ts":
      return [
        "--dir",
        "tooling/generators",
        "test",
        "--",
        "saasFrontendFoundation.test.ts",
        "saasFrontendGeneratedTarget.test.ts",
      ];
    case "pnpm smoke:golden:browser":
      return ["smoke:golden:browser"];
    case "pnpm smoke:golden:a11y":
      return ["smoke:golden:a11y"];
    case "pnpm smoke:golden:visual":
      return ["smoke:golden:visual"];
  }
};

const strictIso = (value: string, label: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    throw new Error(`${label} must be strict ISO-8601 UTC`);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    throw new Error(`${label} must be a finite timestamp`);
  return time;
};

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

function assertFreshEvidence(
  repositoryRoot: string,
  evidencePaths: readonly string[],
  startedAt: string,
  finishedAt: string,
): void {
  const root = realpathSync(repositoryRoot);
  const started = strictIso(startedAt, "run startedAt");
  const finished = strictIso(finishedAt, "run finishedAt");
  if (started > finished) throw new Error("Golden run timestamps are invalid");
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
  for (const deviation of input.deviations) {
    for (const value of [
      deviation.source,
      deviation.destination,
      deviation.change,
      deviation.reason,
      deviation.evidence,
      deviation.sourceAuthority,
      ...deviation.evidencePaths,
      ...deviation.evidenceChecks,
    ])
      assertSafeMetadata(value, "deviation");
  }
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

// eslint-disable-next-line complexity -- validates the fixed receipt authority fields.
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

// eslint-disable-next-line complexity -- validates each required command result field.
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
    typeof command.completedAt !== "string" ||
    command.completedAt.length === 0 ||
    strictIso(command.startedAt, "command startedAt") >
      strictIso(command.finishedAt, "command finishedAt") ||
    !Number.isFinite(strictIso(command.completedAt, "command completedAt"))
  )
    throw new Error("Golden run receipt command timestamp is invalid");
}

// eslint-disable-next-line complexity -- validates the bounded fixed receipt contract.
function assertExecutableReceipt(receipt: GoldenRunReceipt): void {
  const runStarted = strictIso(receipt.startedAt, "run startedAt");
  const runFinished = strictIso(receipt.finishedAt, "run finishedAt");
  if (runStarted > runFinished)
    throw new Error("Golden run receipt timestamps are invalid");
  const generated = strictIso(receipt.generatedAt, "generatedAt");
  if (generated < runStarted || generated > runFinished)
    throw new Error("generatedAt falls outside the recorded run");
  if (
    !Array.isArray(receipt.evidencePaths) ||
    receipt.evidencePaths.length === 0
  )
    throw new Error("Golden run receipt must include evidence paths");
  if (!Array.isArray(receipt.commands) || receipt.commands.length === 0)
    throw new Error("Golden run receipt must include command results");
  for (const command of receipt.commands) {
    assertCommandResult(command);
    const started = strictIso(command.startedAt, "command startedAt");
    const finished = strictIso(command.finishedAt, "command finishedAt");
    const completed = strictIso(command.completedAt, "command completedAt");
    if (
      started < runStarted ||
      finished > runFinished ||
      started > completed ||
      completed > finished ||
      started > finished
    )
      throw new Error("Command timestamps fall outside the recorded run");
  }
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

export function buildGoldenSummaryInput(input: {
  repositoryRoot: string;
  receipt: GoldenRunReceipt;
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

  const receipt = input.receipt;
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

export function runGoldenSummaryCommands(
  repositoryRoot: string,
  execute: GoldenCommandExecutor = ({ argv, cwd }) => {
    try {
      execFileSync("pnpm", argv, { cwd, stdio: "inherit" });
      return 0;
    } catch (error) {
      return typeof error === "object" && error !== null && "status" in error
        ? Number(error.status) || 1
        : 1;
    }
  },
): GoldenRunReceipt {
  const root = resolve(repositoryRoot);
  const finalHead = exactHead(root);
  const manifest = readJson(join(root, "docs/template/saas-ui-upstream.json"));
  const authority = readJson(
    join(root, "artifacts/saas-ui-golden/authority-generated.json"),
  );
  if (typeof authority.digest !== "string")
    throw new Error("Generated authority digest is missing");
  const startedAt = new Date().toISOString();
  const commands = REQUIRED_GOLDEN_COMMANDS.map((command) => {
    const commandStartedAt = new Date().toISOString();
    const exitCode = execute({
      command,
      argv: commandArgv(command),
      cwd: root,
    });
    const finishedAt = new Date().toISOString();
    return {
      command,
      startedAt: commandStartedAt,
      finishedAt,
      completedAt: finishedAt,
      exitCode,
      result: `exitCode=${exitCode}`,
    };
  });
  if (exactHead(root) !== finalHead)
    throw new Error("Repository HEAD changed while golden commands ran");
  const finishedAt = new Date().toISOString();
  return {
    schemaVersion: 2,
    createdBy: "saas-ui:golden-summary-runner",
    startedAt,
    finishedAt,
    generatedAt: finishedAt,
    finalHead,
    pins: exactPins(manifest.pins),
    generatedDigest: authority.digest,
    deviations: [],
    evidencePaths: [
      "artifacts/saas-ui-golden/authority-generated.json",
      "artifacts/saas-ui-golden/authority-reference.json",
    ],
    commands,
  };
}

export function assertSafeSummaryOutput(
  repositoryRoot: string,
  outputRoot: string,
): void {
  const expected = resolve(repositoryRoot, "artifacts/saas-ui-golden");
  if (resolve(outputRoot) !== expected)
    throw new Error("Summary output must be the fixed artifacts directory");
  mkdirSync(expected, { recursive: true });
  const repositoryRealPath = realpathSync(repositoryRoot);
  const outputRealPath = realpathSync(expected);
  if (
    lstatSync(expected).isSymbolicLink() ||
    relative(repositoryRealPath, outputRealPath).startsWith("..")
  )
    throw new Error("Summary output directory must not be a symlink");
  for (const name of SUMMARY_NAMES) {
    const path = join(expected, name);
    try {
      if (lstatSync(path).isSymbolicLink())
        throw new Error(`Summary output file must not be a symlink: ${name}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("must not"))
        throw error;
    }
  }
}

export function writeGoldenSummaries(
  outputRoot: string,
  input: GoldenSummaryInput,
  repositoryRoot = process.cwd(),
): void {
  assertSafeSummaryOutput(repositoryRoot, outputRoot);
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
