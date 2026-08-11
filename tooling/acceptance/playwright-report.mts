export type AcceptanceTestIdentity = {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly behaviorTag: string;
};

export type AcceptanceTestAnnotation = {
  readonly type: string;
  readonly description?: string;
};

export type AcceptanceTestResult = {
  readonly status: string;
  readonly retry: number;
  readonly error?: string;
};

export type PlaywrightTestRecord = AcceptanceTestIdentity & {
  readonly expectedStatus: string;
  readonly annotations: readonly AcceptanceTestAnnotation[];
  readonly results: readonly AcceptanceTestResult[];
};

export type ParsedPlaywrightJsonReport = {
  readonly config: {
    readonly workers: number;
    readonly forbidOnly: boolean;
    readonly projects: readonly {
      readonly name: string;
      readonly retries: number;
      readonly testDir: string;
      readonly testMatch: string;
    }[];
  };
  readonly tests: readonly PlaywrightTestRecord[];
};

type RecordValue = Record<string, unknown>;

const record = (value: unknown, label: string): RecordValue => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as RecordValue;
};

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
};

const integer = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value))
    throw new Error(`${label} must be an integer`);
  return value as number;
};

const array = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
};

const testMatch = (value: unknown): string => {
  if (typeof value === "string") return value;
  const matches = array(value, "config project.testMatch");
  if (matches.length !== 1)
    throw new Error(
      "config project.testMatch must contain exactly one pattern",
    );
  return text(matches[0], "config project.testMatch[0]");
};

const parseAnnotations = (
  value: unknown,
  label: string,
): readonly AcceptanceTestAnnotation[] =>
  array(value ?? [], label).map((item) => {
    const annotation = record(item, "annotation");
    const output: AcceptanceTestAnnotation = {
      type: text(annotation.type, "annotation.type"),
    };
    return annotation.description === undefined
      ? output
      : {
          ...output,
          description: text(annotation.description, "annotation.description"),
        };
  });

const parseResultError = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  const errors = array(value, "result.errors");
  if (errors.length === 0) return undefined;
  return text(
    record(errors[0], "result error").message,
    "result error.message",
  );
};

const behaviorTagPattern = /^@BHV-[A-Z0-9]+-[0-9]+-R[1-9][0-9]*$/u;

const canonicalBehaviorTag = (tag: string): string =>
  tag.startsWith("@") ? tag : `@${tag}`;

const parseConfig = (value: unknown): ParsedPlaywrightJsonReport["config"] => {
  const config = record(value, "config");
  const workers = integer(config.workers, "config.workers");
  if (workers !== 1) throw new Error("Playwright config workers must be 1");
  if (config.forbidOnly !== true)
    throw new Error("Playwright config forbidOnly must be true");
  const projects = array(config.projects, "config.projects").map((item) => {
    const project = record(item, "config project");
    return {
      name: text(project.name, "config project.name"),
      retries: integer(project.retries, "config project.retries"),
      testDir: text(project.testDir, "config project.testDir"),
      testMatch: testMatch(project.testMatch),
    };
  });
  if (projects.length !== 1)
    throw new Error("Playwright config must have exactly one project");
  const project = projects[0];
  if (project?.name !== "acceptance-chromium")
    throw new Error("Playwright config project must be acceptance-chromium");
  if (project.retries !== 0)
    throw new Error("Playwright config retries must be 0");
  return { workers, forbidOnly: true, projects };
};

type Suite = {
  readonly file?: string;
  readonly specs?: readonly unknown[];
  readonly suites?: readonly unknown[];
};

const parseSpec = (
  value: unknown,
  suiteFile: string | undefined,
  projectName: string,
): PlaywrightTestRecord => {
  const spec = record(value, "spec");
  const id = text(spec.id, "spec.id");
  const file = text(spec.file ?? suiteFile, "spec.file");
  const title = text(spec.title, "spec.title");
  const tags = array(spec.tags, "spec.tags").map((tag) =>
    canonicalBehaviorTag(text(tag, "spec tag")),
  );
  const behaviorTags = tags.filter((tag) => behaviorTagPattern.test(tag));
  if (behaviorTags.length !== 1)
    throw new Error(`spec ${id} must have exactly one behavior tag`);
  const tests = array(spec.tests, "spec.tests");
  const matchingTests = tests.filter((value) => {
    const test = record(value, "spec test");
    return test.projectName === projectName;
  });
  if (matchingTests.length !== 1)
    throw new Error(`spec ${id} must have exactly one ${projectName} test`);
  const test = record(matchingTests[0], "spec test");
  const results = array(test.results, "test.results").map((value) => {
    const result = record(value, "test result");
    const error = parseResultError(result.errors);
    return {
      status: text(result.status, "result.status"),
      retry: integer(result.retry, "result.retry"),
      ...(error === undefined ? {} : { error }),
    };
  });
  return {
    id,
    file,
    title,
    behaviorTag: behaviorTags[0] as string,
    expectedStatus: text(test.expectedStatus, "test.expectedStatus"),
    annotations: parseAnnotations(
      test.annotations ?? spec.annotations,
      "test.annotations",
    ),
    results,
  };
};

const parseSuite = (
  value: unknown,
  projectName: string,
  inheritedFile?: string,
): readonly PlaywrightTestRecord[] => {
  const suite = record(value, "suite") as Suite;
  const file = suite.file ?? inheritedFile;
  return [
    ...array(suite.specs ?? [], "suite.specs").map((spec) =>
      parseSpec(spec, file, projectName),
    ),
    ...array(suite.suites ?? [], "suite.suites").flatMap((child) =>
      parseSuite(child, projectName, file),
    ),
  ];
};

export const parsePlaywrightJsonReport = (
  value: unknown,
): ParsedPlaywrightJsonReport => {
  const root = record(value, "Playwright JSON report");
  const config = parseConfig(root.config);
  const suites = array(root.suites, "suites");
  return {
    config,
    tests: suites.flatMap((suite) => parseSuite(suite, "acceptance-chromium")),
  };
};

const canonicalTestMatch = "**/*.spec.ts";

const isAbsolutePath = (path: string): boolean =>
  path.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(path);

const isRelativeAcceptanceSpec = (file: string): boolean => {
  const normalized = file.replace(/\\/gu, "/");
  const isTestDirRelative = !normalized.startsWith("tests/");
  const isSourceRelative = normalized.startsWith("tests/acceptance/");
  return (
    !isAbsolutePath(file) &&
    !normalized.split("/").includes("..") &&
    (isTestDirRelative || isSourceRelative) &&
    normalized.endsWith(".spec.ts")
  );
};

export const validateAcceptanceReportBoundary = (input: {
  readonly sourceRoot: string;
  readonly report: ParsedPlaywrightJsonReport;
}): void => {
  const sourceRoot = input.sourceRoot.replace(/[\\/]+$/u, "");
  const expectedTestDir = `${sourceRoot}/tests/acceptance`;
  const project = input.report.config.projects[0];
  if (project?.testDir !== expectedTestDir)
    throw new Error(
      `Playwright project testDir must be ${expectedTestDir}; received ${project?.testDir ?? "missing"}`,
    );
  if (project.testMatch !== canonicalTestMatch)
    throw new Error(
      `Playwright project testMatch must be ${canonicalTestMatch}; received ${project.testMatch}`,
    );
  for (const test of input.report.tests) {
    if (!isRelativeAcceptanceSpec(test.file))
      throw new Error(
        `Playwright test file must be a relative acceptance spec path: ${test.file}`,
      );
  }
};
