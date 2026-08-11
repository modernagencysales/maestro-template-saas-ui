import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parsePlaywrightJsonReport,
  isRelativePathInside,
  validateAcceptanceReportBoundary,
  validateNativeAcceptanceReportBoundary,
} from "./playwright-report.mts";

const spec = {
  id: "spec-001",
  title: "a record appears",
  tags: ["@BHV-REC-001-R1"],
  file: "tests/acceptance/records.spec.ts",
};

const runtimeReport = {
  config: {
    rootDir: "/fixture/tests/acceptance",
    workers: 1,
    forbidOnly: true,
    fullyParallel: false,
    globalSetup: null,
    globalTeardown: null,
    webServer: null,
    repeatEach: null,
    testIgnore: null,
    projects: [
      {
        name: "acceptance-chromium",
        retries: 0,
        repeatEach: 1,
        testIgnore: [],
        testDir: "/fixture/tests/acceptance",
        testMatch: "**/*.spec.ts",
      },
    ],
  },
  suites: [
    {
      title: "",
      file: "tests/acceptance/records.spec.ts",
      specs: [
        {
          ...spec,
          tests: [
            {
              projectName: "acceptance-chromium",
              expectedStatus: "passed",
              annotations: [{ type: "slow", description: "fixture" }],
              results: [{ status: "passed", retry: 0, duration: 2 }],
            },
          ],
        },
      ],
    },
  ],
};

describe("parsePlaywrightJsonReport", () => {
  it("does not treat a Windows parent path as contained", () => {
    expect(isRelativePathInside("..\\outside")).toBe(false);
  });

  it("normalizes native JSON reporter tags to canonical behavior tags", () => {
    expect(
      parsePlaywrightJsonReport({
        ...runtimeReport,
        suites: [
          {
            ...runtimeReport.suites[0],
            specs: [
              {
                ...spec,
                tags: ["BHV-REC-001-R1"],
                tests: runtimeReport.suites[0]?.specs[0]?.tests,
              },
            ],
          },
        ],
      }).tests[0]?.behaviorTag,
    ).toBe("@BHV-REC-001-R1");
  });

  it("flattens native spec identities and runtime results by spec id", () => {
    expect(parsePlaywrightJsonReport(runtimeReport)).toEqual({
      config: runtimeReport.config,
      tests: [
        {
          id: "spec-001",
          file: "tests/acceptance/records.spec.ts",
          title: "a record appears",
          behaviorTag: "@BHV-REC-001-R1",
          expectedStatus: "passed",
          annotations: [{ type: "slow", description: "fixture" }],
          results: [{ status: "passed", retry: 0 }],
        },
      ],
    });
  });

  it("preserves the resolved native project directory and selection", () => {
    expect(
      parsePlaywrightJsonReport(runtimeReport).config.projects[0],
    ).toMatchObject({
      testDir: "/fixture/tests/acceptance",
      testMatch: "**/*.spec.ts",
    });
  });

  it("normalizes the native singleton testMatch array", () => {
    const report = parsePlaywrightJsonReport({
      ...runtimeReport,
      config: {
        ...runtimeReport.config,
        projects: [
          {
            ...runtimeReport.config.projects[0],
            testMatch: ["**/*.spec.ts"],
          },
        ],
      },
    });
    expect(report.config.projects[0]?.testMatch).toBe("**/*.spec.ts");
  });

  it("rejects a spec that contains a foreign project result", () => {
    expect(() =>
      parsePlaywrightJsonReport({
        ...runtimeReport,
        suites: [
          {
            ...runtimeReport.suites[0],
            specs: [
              {
                ...spec,
                tests: [
                  ...(runtimeReport.suites[0]?.specs[0]?.tests ?? []),
                  {
                    projectName: "foreign-project",
                    expectedStatus: "passed",
                    annotations: [],
                    results: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/exactly one|acceptance-chromium/i);
  });

  it("rejects nonempty top-level native reporter errors", () => {
    expect(() =>
      parsePlaywrightJsonReport({
        ...runtimeReport,
        errors: [{ message: "foreign native failure" }],
      }),
    ).toThrow(/errors/i);
  });

  it("rejects reports redirected outside the resolved acceptance tree", () => {
    const report = parsePlaywrightJsonReport({
      ...runtimeReport,
      config: {
        ...runtimeReport.config,
        projects: [
          {
            ...runtimeReport.config.projects[0],
            testDir: "/fixture/tests/unit",
          },
        ],
      },
    });
    expect(() =>
      validateAcceptanceReportBoundary({ sourceRoot: "/fixture", report }),
    ).toThrow(/testDir/i);
  });

  it("inherits the nearest enclosing file through nested suites", () => {
    const nestedReport = {
      ...runtimeReport,
      suites: [
        {
          file: "tests/acceptance/records.spec.ts",
          suites: [
            {
              specs: [
                {
                  id: "nested-spec-001",
                  title: "nested record appears",
                  tags: ["@BHV-REC-001-R1"],
                  tests: runtimeReport.suites[0]?.specs[0]?.tests,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(parsePlaywrightJsonReport(nestedReport).tests[0]).toMatchObject({
      id: "nested-spec-001",
      file: "tests/acceptance/records.spec.ts",
    });
  });

  it.each([
    ["workers", { workers: 2 }],
    ["forbidOnly", { forbidOnly: false }],
    ["zero projects", { projects: [] }],
    [
      "multiple projects",
      {
        projects: [
          { name: "acceptance-chromium", retries: 0 },
          { name: "other", retries: 0 },
        ],
      },
    ],
    ["project name", { projects: [{ name: "chromium", retries: 0 }] }],
    ["retries", { projects: [{ name: "acceptance-chromium", retries: 1 }] }],
    ["fully parallel", { fullyParallel: true }],
    ["global setup", { globalSetup: "./setup" }],
    ["global teardown", { globalTeardown: "./teardown" }],
    ["web server", { webServer: { command: "node server" } }],
    ["repeat each", { repeatEach: 2 }],
    ["test ignore", { testIgnore: ["**/*.spec.ts"] }],
    [
      "project dependency",
      {
        projects: [
          { name: "acceptance-chromium", retries: 0, dependencies: ["other"] },
        ],
      },
    ],
    [
      "project teardown",
      {
        projects: [
          { name: "acceptance-chromium", retries: 0, teardown: "cleanup" },
        ],
      },
    ],
    [
      "storage state",
      {
        projects: [
          {
            name: "acceptance-chromium",
            retries: 0,
            use: { storageState: "state.json" },
          },
        ],
      },
    ],
  ])("rejects invalid native config: %s", (_name, override) => {
    expect(() =>
      parsePlaywrightJsonReport({
        ...runtimeReport,
        config: { ...runtimeReport.config, ...override },
      }),
    ).toThrow();
  });

  it("does not infer behavior identity from a test title", () => {
    expect(() =>
      parsePlaywrightJsonReport({
        ...runtimeReport,
        suites: [
          {
            ...runtimeReport.suites[0],
            specs: [{ ...spec, title: "BHV-REC-999-R1", tags: [], tests: [] }],
          },
        ],
      }),
    ).toThrow(/tag/i);
  });

  it("accepts normalized Windows roots and nested relative specs", () => {
    const report = parsePlaywrightJsonReport({
      ...runtimeReport,
      config: {
        ...runtimeReport.config,
        rootDir: "C:\\fixture\\tests\\acceptance",
        projects: [
          {
            ...runtimeReport.config.projects[0],
            testDir: "C:\\fixture\\tests\\acceptance",
          },
        ],
      },
      suites: [
        {
          ...runtimeReport.suites[0],
          specs: [
            {
              ...spec,
              file: "outside/evil.spec.ts",
              tests: runtimeReport.suites[0]?.specs[0]?.tests,
            },
          ],
        },
      ],
    });
    expect(() =>
      validateAcceptanceReportBoundary({ sourceRoot: "C:\\fixture", report }),
    ).not.toThrow();
  });

  it.each([
    "/tmp/escape.spec.ts",
    "C:\\tmp\\escape.spec.ts",
    "\\escape.spec.ts",
    "\\\\server\\share\\escape.spec.ts",
  ])("rejects absolute test paths: %s", (file) => {
    const report = parsePlaywrightJsonReport({
      ...runtimeReport,
      suites: [
        {
          ...runtimeReport.suites[0],
          specs: [
            { ...spec, file, tests: runtimeReport.suites[0]?.specs[0]?.tests },
          ],
        },
      ],
    });
    expect(() =>
      validateAcceptanceReportBoundary({ sourceRoot: "/fixture", report }),
    ).toThrow(/relative/i);
  });

  it("rejects symlinked acceptance roots and specs that escape them", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-report-"));
    try {
      const outside = join(root, "outside");
      await mkdir(outside);
      await writeFile(join(outside, "evil.spec.ts"), "");
      await mkdir(join(root, "tests"));
      await symlink(outside, join(root, "tests", "acceptance"));
      const report = parsePlaywrightJsonReport({
        ...runtimeReport,
        config: {
          ...runtimeReport.config,
          rootDir: join(root, "tests", "acceptance"),
          projects: [
            {
              ...runtimeReport.config.projects[0],
              testDir: join(root, "tests", "acceptance"),
            },
          ],
        },
      });
      expect(() =>
        validateNativeAcceptanceReportBoundary({ sourceRoot: root, report }),
      ).toThrow(/symlink|escape/i);

      await rm(join(root, "tests", "acceptance"));
      await mkdir(join(root, "tests", "acceptance"));
      await symlink(
        join(outside, "evil.spec.ts"),
        join(root, "tests", "acceptance", "records.spec.ts"),
      );
      expect(() =>
        validateNativeAcceptanceReportBoundary({ sourceRoot: root, report }),
      ).toThrow(/escape/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("permits a native zero-test listing without an acceptance directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-empty-"));
    try {
      const report = parsePlaywrightJsonReport({
        ...runtimeReport,
        config: {
          ...runtimeReport.config,
          rootDir: join(root, "tests", "acceptance"),
          projects: [
            {
              ...runtimeReport.config.projects[0],
              testDir: join(root, "tests", "acceptance"),
            },
          ],
        },
        suites: [],
      });
      expect(() =>
        validateNativeAcceptanceReportBoundary({ sourceRoot: root, report }),
      ).not.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
