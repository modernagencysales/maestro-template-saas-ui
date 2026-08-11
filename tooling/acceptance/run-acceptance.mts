import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  behaviorRevisionTag,
  validateProductContract,
  type ProductContract,
} from "../../packages/template-core/src/productContract";
import {
  parsePlaywrightJsonReport,
  type ParsedPlaywrightJsonReport,
  type PlaywrightTestRecord,
} from "./playwright-report.mts";

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

const configName = "playwright.acceptance.config.ts";

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
  const findings: string[] = [];
  const annotation = annotationType(runtime);
  if (annotation !== undefined)
    findings.push(`selected test ${test.id} was ${annotation}`);
  const result = runtime.results[0];
  if (runtime.results.length !== 1 || result === undefined) {
    findings.push(
      `selected test ${test.id} has no single runtime result and was unexecuted`,
    );
    return findings;
  }
  if (result.status === "skipped")
    findings.push(`selected test ${test.id} was skipped`);
  if (runtime.expectedStatus !== "passed")
    findings.push(
      `selected test ${test.id} has unexpected expected status ${runtime.expectedStatus}`,
    );
  if (result.status !== "passed")
    findings.push(
      `selected test ${test.id} has result status ${result.status}; expected passed`,
    );
  if (result.retry !== 0)
    findings.push(
      `selected test ${test.id} was flaky or retried at retry ${result.retry}`,
    );
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
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.on("error", (error) => {
        stderr.push(Buffer.from(error.message));
        resolveProcess({
          exitCode: 1,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        });
      });
      child.on("close", (exitCode) =>
        resolveProcess({
          exitCode: exitCode ?? 1,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        }),
      );
    });

const readReport = async (
  reportPath: string,
  stdout: string,
): Promise<ParsedPlaywrightJsonReport> => {
  let source = stdout;
  try {
    const file = await readFile(reportPath, "utf8");
    if (file.trim() !== "") source = file;
  } catch {
    // The process seam and older Playwright reporters may emit JSON on stdout.
  }
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
    `${message}${result.stderr.trim() === "" ? "" : `\n${result.stderr.trim()}`}`,
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
      report: await readReport(options.reportPath, result.stdout),
    };
  } catch (error) {
    throw failureWithStderr(
      error instanceof Error ? error.message : String(error),
      result,
    );
  }
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
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "maestro-acceptance-"),
  );
  try {
    const configPath = join(sourceRoot, configName);
    const discoveryPath = join(temporaryDirectory, "discovery.json");
    const discovery = await executeReport({
      runner,
      args: [
        "exec",
        "playwright",
        "test",
        "--config",
        configPath,
        "--list",
        "--reporter=json",
      ],
      environment: { PLAYWRIGHT_JSON_OUTPUT_NAME: discoveryPath },
      reportPath: discoveryPath,
      failureMessage: "Playwright acceptance discovery failed",
      failOnNonzero: true,
    });
    const discovered = discovery.report;
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
    const runtime = await executeReport({
      runner,
      args: runtimeArgs,
      environment: { PLAYWRIGHT_JSON_OUTPUT_NAME: runtimePath },
      reportPath: runtimePath,
      failureMessage: "Playwright acceptance runtime failed",
      failOnNonzero: false,
    });
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
      `${selectedTests(discovered, tags).length} required, ${runtime.report.tests.length} runtime`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};
