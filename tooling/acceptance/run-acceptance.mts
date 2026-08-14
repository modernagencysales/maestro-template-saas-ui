import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  behaviorRevisionTag,
  validateProductContract,
  type ProductContract,
} from "../../packages/template-core/src/productContract";
import {
  parsePlaywrightJsonReport,
  validateAcceptanceReportBoundary,
  validateNativeAcceptanceReportBoundary,
  type ParsedPlaywrightJsonReport,
  type PlaywrightTestRecord,
} from "./playwright-report.mts";
import {
  assertCheckoutState,
  snapshotCheckoutState,
} from "./checkout-state.mts";

export type PlaywrightProcessResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type PlaywrightProcessRunner = (
  args: readonly string[],
  environment: Readonly<Record<string, string>>,
) => Promise<PlaywrightProcessResult>;

type AcceptanceOptions = {
  readonly repoRoot: string;
  readonly sourceRoot: string;
  readonly scope: "required" | "all";
  readonly processRunner?: PlaywrightProcessRunner;
  readonly writeOutput?: (output: string) => void;
};

export type AcceptanceArguments = {
  readonly scope: "required" | "all";
  readonly sourceRoot: ".";
};

export const parseAcceptanceArguments = (
  argv: readonly string[],
): AcceptanceArguments => {
  if (
    argv.length !== 3 ||
    (argv[0] !== "required" && argv[0] !== "all") ||
    argv[1] !== "--source-root" ||
    argv[2] !== "."
  )
    throw new Error("usage: run-acceptance.mts <required|all> --source-root .");
  return {
    scope: argv[0] as "required" | "all",
    sourceRoot: ".",
  };
};

const configName = "playwright.acceptance.config.ts";
const processOutputTailLength = 20_000;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export const escapedTagPattern = (tags: readonly string[]): string =>
  `(?:${tags.map(escapeRegExp).join("|")})`;

export const requiredBehaviorTags = (
  contract: ProductContract,
): readonly string[] =>
  contract.behaviors
    .filter((behavior) => behavior.status === "required")
    .map(behaviorRevisionTag);

const selectedTests = (
  discovered: ParsedPlaywrightJsonReport,
  requiredTags: readonly string[],
): readonly PlaywrightTestRecord[] =>
  requiredTags.length === 0
    ? discovered.tests
    : discovered.tests.filter((test) =>
        requiredTags.includes(test.behaviorTag),
      );

const annotationType = (test: PlaywrightTestRecord): string | undefined =>
  test.annotations
    .map(({ type }) => type.toLowerCase())
    .find((type) => ["skip", "fixme", "fail"].includes(type));

export const redactPlaywrightProcessOutput = (message: string): string =>
  message
    .replace(
      /\b(authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]*/giu,
      "$1: [REDACTED]",
    )
    .replace(
      /(["'](?:authorization|cookie|set-cookie)["']\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/giu,
      (_match, prefix: string, value: string) =>
        `${prefix}${value[0]}[REDACTED]${value[0]}`,
    )
    .replace(/\b(Basic|Bearer)\s+\S+/giu, "$1 [REDACTED]")
    .replace(
      /\b([A-Z_][A-Z0-9_-]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_-]*)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/giu,
      "$1=[REDACTED]",
    );

export const redactedProcessOutputTail = (message: string): string =>
  redactPlaywrightProcessOutput(message).slice(-processOutputTailLength);

export const renderBoundedPlaywrightProcessOutput = (
  message: string,
): string => {
  const redacted = redactPlaywrightProcessOutput(message);
  const normalized = redacted.replace(/\s+/gu, " ").trim();
  if (normalized.length <= 500) return normalized;
  const headLength = Math.floor((500 - 1) / 2);
  return `${normalized.slice(0, headLength)}…${normalized.slice(-(500 - headLength - 1))}`;
};

const identityFindings = (
  discovery: PlaywrightTestRecord,
  runtime: PlaywrightTestRecord,
): readonly string[] =>
  (["file", "title", "behaviorTag"] as const)
    .filter((field) => runtime[field] !== discovery[field])
    .map(
      (field) =>
        `selected test ${discovery.id} identity mismatch for ${field}: discovery=${discovery[field]} runtime=${runtime[field]}`,
    );

const resultFindings = (
  test: PlaywrightTestRecord,
  runtime: PlaywrightTestRecord,
): readonly string[] => {
  const result = runtime.results[0];
  const findings: string[] = [];
  if (runtime.results.length !== 1 || result === undefined)
    return [
      `selected test ${test.id} has no single runtime result and was unexecuted`,
    ];
  if (result.status === "skipped")
    findings.push(`selected test ${test.id} was skipped`);
  if (runtime.expectedStatus !== "passed")
    findings.push(
      `selected test ${test.id} has unexpected expected status ${runtime.expectedStatus}`,
    );
  if (result.status !== "passed")
    findings.push(
      `selected test ${test.id} (${test.behaviorTag} ${test.title}) has result status ${result.status}; expected passed${result.error === undefined ? "" : `; native error: ${renderBoundedPlaywrightProcessOutput(result.error)}`}`,
    );
  if (result.retry !== 0)
    findings.push(
      `selected test ${test.id} was flaky or retried at retry ${result.retry}`,
    );
  return findings;
};

const validateSelectedTest = (
  test: PlaywrightTestRecord,
  results: readonly PlaywrightTestRecord[],
): readonly string[] => {
  if (results.length === 0)
    return [`missing runtime result for selected test ${test.id}`];
  if (results.length > 1)
    return [
      `selected test ${test.id} has ${results.length} runtime records; expected exactly one`,
    ];
  const runtime = results[0] as PlaywrightTestRecord;
  const findings = [...identityFindings(test, runtime)];
  const annotation = annotationType(runtime);
  if (annotation !== undefined)
    findings.push(`selected test ${test.id} was ${annotation}`);
  findings.push(...resultFindings(test, runtime));
  return findings;
};

export const validateAcceptanceRuntime = (input: {
  readonly requiredTags: readonly string[];
  readonly discovered: ParsedPlaywrightJsonReport;
  readonly runtime: ParsedPlaywrightJsonReport;
  readonly processExitCode: number;
}): readonly string[] => {
  const selected = selectedTests(input.discovered, input.requiredTags);
  const selectedById = new Map(selected.map((test) => [test.id, test]));
  const findings = input.requiredTags
    .filter((tag) => !selected.some((test) => test.behaviorTag === tag))
    .map((tag) => `acceptance selection is missing required tag ${tag}`);
  const discoveredIds = new Set<string>();
  for (const test of input.discovered.tests) {
    if (discoveredIds.has(test.id))
      findings.push(`duplicate discovered acceptance test id ${test.id}`);
    discoveredIds.add(test.id);
  }
  if (input.processExitCode !== 0)
    findings.push(
      `Playwright exited with code ${input.processExitCode}; required acceptance execution failed`,
    );

  const runtimeById = new Map<string, PlaywrightTestRecord[]>();
  for (const test of input.runtime.tests) {
    const matches = runtimeById.get(test.id) ?? [];
    matches.push(test);
    runtimeById.set(test.id, matches);
    if (!selectedById.has(test.id))
      findings.push(
        `acceptance selection mismatch: runtime test ${test.id} was not selected`,
      );
  }

  for (const test of selected)
    findings.push(
      ...validateSelectedTest(test, runtimeById.get(test.id) ?? []),
    );
  return findings;
};

const defaultProcessRunner =
  (repoRoot: string): PlaywrightProcessRunner =>
  (args, environment) =>
    new Promise((resolveProcess) => {
      const child = spawn("pnpm", args, {
        cwd: repoRoot,
        env: { ...process.env, ...environment },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const appendTail = (output: string, chunk: Buffer): string =>
        redactedProcessOutputTail(`${output}${chunk.toString("utf8")}`);
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout = appendTail(stdout, chunk);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr = appendTail(stderr, chunk);
      });
      child.on("error", (error) => {
        stderr = appendTail(stderr, Buffer.from(error.message));
        resolveProcess({
          exitCode: 1,
          stdout,
          stderr,
        });
      });
      child.on("close", (exitCode) =>
        resolveProcess({
          exitCode: exitCode ?? 1,
          stdout,
          stderr,
        }),
      );
    });

const readReport = async (
  reportPath: string,
): Promise<ParsedPlaywrightJsonReport> => {
  const source = await readFile(reportPath, "utf8");
  if (source.trim() === "")
    throw new Error(`Playwright JSON report file ${reportPath} is empty`);
  try {
    return parsePlaywrightJsonReport(JSON.parse(source) as unknown);
  } catch (error) {
    throw new Error(
      `Playwright JSON report was invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const readContract = async (sourceRoot: string): Promise<ProductContract> => {
  try {
    const source = await readFile(
      join(sourceRoot, "product.contract.yaml"),
      "utf8",
    );
    return validateProductContract(parseYaml(source));
  } catch (error) {
    throw new Error(
      `product.contract.yaml: invalid product contract: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const ensureSourceRoot = (repoRoot: string, sourceRoot: string): string => {
  if (sourceRoot.startsWith("/"))
    throw new Error("source-root must be relative");
  const root = resolve(repoRoot);
  const source = resolve(root, sourceRoot);
  if (source !== root && !source.startsWith(`${root}${sep}`))
    throw new Error("source-root must remain beneath the repository root");
  return source;
};

const failureWithStderr = (
  message: string,
  result: PlaywrightProcessResult,
): Error =>
  new Error(
    `${message}${result.stderr.trim() === "" ? "" : `\nnative stderr: ${renderBoundedPlaywrightProcessOutput(result.stderr)}`}`,
  );

const executeReport = async (options: {
  readonly runner: PlaywrightProcessRunner;
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly reportPath: string;
  readonly failureMessage: string;
  readonly failOnNonzero: boolean;
}): Promise<{
  readonly result: PlaywrightProcessResult;
  readonly report: ParsedPlaywrightJsonReport;
}> => {
  const result = await options.runner(options.args, options.environment);
  if (options.failOnNonzero && result.exitCode !== 0)
    throw failureWithStderr(options.failureMessage, result);
  try {
    return {
      result,
      report: await readReport(options.reportPath),
    };
  } catch (error) {
    throw failureWithStderr(
      `Playwright JSON report unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
      result,
    );
  }
};

const validateReport = (
  sourceRoot: string,
  report: ParsedPlaywrightJsonReport,
  native: boolean,
): void => {
  validateAcceptanceReportBoundary({ sourceRoot, report });
  if (native) validateNativeAcceptanceReportBoundary({ sourceRoot, report });
};

export const runAcceptance = async (
  options: AcceptanceOptions,
): Promise<void> => {
  const sourceRoot = ensureSourceRoot(options.repoRoot, options.sourceRoot);
  const contract = await readContract(sourceRoot);
  const requiredTags = requiredBehaviorTags(contract);
  const writeOutput = options.writeOutput ?? console.log;
  if (options.scope === "required" && requiredTags.length === 0) {
    writeOutput("0 required, 0 runtime");
    return;
  }

  const runner =
    options.processRunner ?? defaultProcessRunner(options.repoRoot);
  const initialCheckoutState = snapshotCheckoutState(sourceRoot);
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "maestro-acceptance-"),
  );
  try {
    const configPath = join(sourceRoot, configName);
    const discoveryPath = join(temporaryDirectory, "discovery.json");
    let discovery: Awaited<ReturnType<typeof executeReport>>;
    try {
      discovery = await executeReport({
        runner,
        args: [
          "exec",
          "playwright",
          "test",
          "--config",
          configPath,
          "--list",
          "--pass-with-no-tests",
          "--reporter=json",
        ],
        environment: { PLAYWRIGHT_JSON_OUTPUT_NAME: discoveryPath },
        reportPath: discoveryPath,
        failureMessage: "Playwright acceptance discovery failed",
        failOnNonzero: true,
      });
    } finally {
      assertCheckoutState(
        initialCheckoutState,
        "Acceptance checkout/source mutation during discovery",
      );
    }
    const discovered = discovery.report;
    validateReport(sourceRoot, discovered, options.processRunner === undefined);
    const tags = options.scope === "required" ? requiredTags : [];
    const runtimePath = join(temporaryDirectory, "runtime.json");
    const runtimeArgs = [
      "exec",
      "playwright",
      "test",
      "--config",
      configPath,
      ...(tags.length === 0 ? [] : ["--grep", escapedTagPattern(tags)]),
      "--reporter=json",
    ];
    let runtime: Awaited<ReturnType<typeof executeReport>>;
    try {
      runtime = await executeReport({
        runner,
        args: runtimeArgs,
        environment: { PLAYWRIGHT_JSON_OUTPUT_NAME: runtimePath },
        reportPath: runtimePath,
        failureMessage: "Playwright acceptance runtime failed",
        failOnNonzero: false,
      });
    } finally {
      assertCheckoutState(
        initialCheckoutState,
        "Acceptance checkout/source mutation during runtime",
      );
    }
    validateReport(
      sourceRoot,
      runtime.report,
      options.processRunner === undefined,
    );
    const findings = validateAcceptanceRuntime({
      requiredTags: tags,
      discovered: discovery.report,
      runtime: runtime.report,
      processExitCode: runtime.result.exitCode,
    });
    if (findings.length > 0)
      throw failureWithStderr(
        `Acceptance runtime validation failed:\n${findings.join("\n")}`,
        runtime.result,
      );
    writeOutput(
      options.scope === "required"
        ? `${tags.length} required, ${runtime.report.tests.length} runtime`
        : `${selectedTests(discovered, tags).length} selected, ${runtime.report.tests.length} runtime`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

const isDirectEntryPoint = (): boolean => {
  const entry = process.argv[1];
  return (
    entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)
  );
};

if (isDirectEntryPoint()) {
  try {
    const arguments_ = parseAcceptanceArguments(process.argv.slice(2));
    const fileRoot = resolve(
      fileURLToPath(new URL(".", import.meta.url)),
      "../..",
    );
    await runAcceptance({
      repoRoot: fileRoot,
      sourceRoot: arguments_.sourceRoot,
      scope: arguments_.scope,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
