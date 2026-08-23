import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { assertSaasUiArtifactSafety } from "./check-saas-ui-artifact-safety.mts";
import { isDirectRun } from "./src/direct-run.mts";

const STARTER_RECEIPT = "docs/template/saas-ui-starter-files.json";
const REGISTRY_RECEIPT = "docs/template/saas-ui-registry-files.json";
const BASELINE = "tooling/quality/fixtures/saas-ui-typecheck-baseline.json";
const LOCKFILE = "pnpm-lock.yaml";
const diagnosticPattern = /^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/u;
const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const normalize = (path: string): string => path.replaceAll("\\", "/");

export type SaasUiTypecheckDiagnostic = Readonly<{
  path: string;
  line: number;
  column: number;
  code: string;
}>;

export type SaasUiTypecheckBaseline = Readonly<{
  schemaVersion: 1;
  pnpmLockSha256: string;
  typescriptVersion: string;
  diagnosticCount: number;
  diagnosticsSha256: string;
}>;

export const saasUiTypecheckBaselinePath = BASELINE;

type ReceiptFile = Readonly<{
  destination: string;
  sha256: string;
  adapted?: boolean;
}>;

type Receipt = Readonly<{ files: readonly ReceiptFile[] }>;

type CheckOptions = Readonly<{
  artifactSafety?: (root: string) => readonly string[];
  typescriptVersion?: string;
}>;

const diagnosticKey = ({ path, code }: SaasUiTypecheckDiagnostic): string =>
  JSON.stringify({ path, code });

const diagnosticIdentities = (
  diagnostics: readonly SaasUiTypecheckDiagnostic[],
): readonly string[] =>
  [
    ...new Set(
      diagnostics
        .filter(({ path }) => !path.startsWith("node_modules/"))
        .map(diagnosticKey),
    ),
  ].sort();

const diagnosticsDigest = (
  diagnostics: readonly SaasUiTypecheckDiagnostic[],
): string => sha256(diagnosticIdentities(diagnostics).join("\n"));

export const createSaasUiTypecheckBaseline = (
  root: string,
  output: string,
  typescriptVersion: string,
): SaasUiTypecheckBaseline => {
  const diagnostics = parseSaasUiTypecheckDiagnostics(root, output);
  if (diagnostics.length > 0)
    throw new Error(
      `cannot generate the Saas UI typecheck baseline until raw TypeScript has zero diagnostics\n${output.trim()}`,
    );
  return {
    schemaVersion: 1,
    pnpmLockSha256: sha256(readFileSync(resolve(root, LOCKFILE))),
    typescriptVersion,
    diagnosticCount: diagnosticIdentities(diagnostics).length,
    diagnosticsSha256: diagnosticsDigest(diagnostics),
  };
};

const readJson = <T,>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

type ReceiptPaths = Readonly<{
  exact: ReadonlySet<string>;
  adapted: ReadonlySet<string>;
}>;

const receiptPaths = (root: string, path: string): ReceiptPaths => {
  const receipt = readJson<Receipt>(resolve(root, path));
  const exact = new Set<string>();
  const adapted = new Set<string>();
  for (const file of receipt.files) {
    if (typeof file.destination !== "string" || typeof file.sha256 !== "string")
      continue;
    const destination = normalize(file.destination);
    if (destination.startsWith("/") || destination.includes("..")) continue;
    const absolute = resolve(root, destination);
    if (!existsSync(absolute) || sha256(readFileSync(absolute)) !== file.sha256)
      continue;
    (file.adapted === true ? adapted : exact).add(destination);
  }
  return { exact, adapted };
};

export const verifiedImmutableReceiptPaths = (root: string): Set<string> => {
  const receipts = [
    receiptPaths(root, STARTER_RECEIPT),
    receiptPaths(root, REGISTRY_RECEIPT),
  ];
  const adapted = new Set(receipts.flatMap((receipt) => [...receipt.adapted]));
  return new Set(
    receipts.flatMap((receipt) =>
      [...receipt.exact].filter((destination) => !adapted.has(destination)),
    ),
  );
};

export const parseSaasUiTypecheckDiagnostics = (
  root: string,
  output: string,
): readonly SaasUiTypecheckDiagnostic[] =>
  output.split("\n").flatMap((line) => {
    const match = diagnosticPattern.exec(line);
    if (!match) return [];
    const [, path, lineNumber, column, code] = match;
    if (
      path === undefined ||
      lineNumber === undefined ||
      column === undefined ||
      code === undefined
    )
      return [];
    const absolute = resolve(root, path);
    const normalizedPath = normalize(relative(root, absolute));
    return [
      {
        path: normalizedPath,
        line: Number(lineNumber),
        column: Number(column),
        code,
      },
    ];
  });

const currentTypescriptVersion = (root: string): string => {
  const packagePath = resolve(root, "node_modules/typescript/package.json");
  const value = readJson<{ version?: unknown }>(packagePath);
  if (typeof value.version !== "string")
    throw new Error("installed TypeScript version is invalid");
  return value.version;
};

const parseBaseline = (root: string): SaasUiTypecheckBaseline => {
  const value = readJson<SaasUiTypecheckBaseline>(resolve(root, BASELINE));
  if (
    value.schemaVersion !== 1 ||
    typeof value.pnpmLockSha256 !== "string" ||
    typeof value.typescriptVersion !== "string" ||
    typeof value.diagnosticCount !== "number" ||
    !Number.isInteger(value.diagnosticCount) ||
    value.diagnosticCount < 0 ||
    !/^[a-f0-9]{64}$/u.test(value.diagnosticsSha256)
  )
    throw new Error("Saas UI typecheck baseline is invalid");
  return value;
};

const baselineEnvironmentErrors = (
  root: string,
  baseline: SaasUiTypecheckBaseline,
  typescriptVersion: string,
): readonly string[] => {
  const errors: string[] = [];
  const lockPath = resolve(root, LOCKFILE);
  if (
    !existsSync(lockPath) ||
    sha256(readFileSync(lockPath)) !== baseline.pnpmLockSha256
  )
    errors.push("pnpm-lock.yaml hash does not match the diagnostic baseline");
  if (typescriptVersion !== baseline.typescriptVersion)
    errors.push(
      "installed TypeScript version does not match the diagnostic baseline",
    );
  return errors;
};

const receiptDiagnosticErrors = (
  root: string,
  diagnostics: readonly SaasUiTypecheckDiagnostic[],
): readonly string[] => {
  try {
    const receiptPaths = verifiedImmutableReceiptPaths(root);
    return diagnostics
      .filter(
        ({ path }) =>
          !path.startsWith("node_modules/") && !receiptPaths.has(path),
      )
      .map(({ path }) => `diagnostic path is not receipt-verified: ${path}`);
  } catch {
    return ["unable to read receipt paths for the diagnostic baseline"];
  }
};

export const assertSaasUiTypecheckDiagnostics = (
  root: string,
  output: string,
  baseline: SaasUiTypecheckBaseline,
  options: CheckOptions = {},
): readonly string[] => {
  const errors = [
    ...(options.artifactSafety ?? assertSaasUiArtifactSafety)(root),
  ];
  const typescriptVersion =
    options.typescriptVersion ?? currentTypescriptVersion(root);
  const diagnostics = parseSaasUiTypecheckDiagnostics(root, output);
  errors.push(...baselineEnvironmentErrors(root, baseline, typescriptVersion));
  errors.push(...receiptDiagnosticErrors(root, diagnostics));
  if (
    baseline.diagnosticCount !== 0 ||
    baseline.diagnosticsSha256 !== sha256("")
  )
    errors.push("Saas UI typecheck baseline must encode zero diagnostics");
  if (diagnostics.length > 0)
    errors.push("Saas UI raw TypeScript must report zero diagnostics");
  if (diagnosticIdentities(diagnostics).length !== baseline.diagnosticCount)
    errors.push("diagnostic count does not match the baseline");
  if (diagnosticsDigest(diagnostics) !== baseline.diagnosticsSha256)
    errors.push("diagnostic identities do not match the baseline");
  return [...new Set(errors)].sort((left, right) => left.localeCompare(right));
};

export const checkSaasUiTypecheck = (
  root = process.cwd(),
): readonly string[] => {
  const baseline = parseBaseline(root);
  const artifactSafety = assertSaasUiArtifactSafety(root);
  if (artifactSafety.length > 0) return artifactSafety;
  let output = "";
  try {
    execFileSync(
      resolve(root, "node_modules/.bin/tsc"),
      [
        "-p",
        "apps/web/tsconfig.json",
        "--noEmit",
        "--incremental",
        "false",
        "--pretty",
        "false",
      ],
      { cwd: root, encoding: "utf8", stdio: "pipe" },
    );
  } catch (error) {
    const result = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    output = `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`;
  }
  return assertSaasUiTypecheckDiagnostics(root, output, baseline, {
    artifactSafety: () => artifactSafety,
  });
};

if (isDirectRun(import.meta.url)) {
  const errors = checkSaasUiTypecheck();
  if (errors.length > 0) {
    for (const error of errors)
      console.error(`check:saas-ui-typecheck: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("check:saas-ui-typecheck: ok");
  }
}
