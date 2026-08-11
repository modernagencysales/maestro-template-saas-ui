import { describe, expect, it } from "vitest";
import { parsePlaywrightJsonReport } from "./playwright-report.mts";

const spec = {
  id: "spec-001",
  title: "a record appears",
  tags: ["@BHV-REC-001-R1"],
  file: "tests/acceptance/records.spec.ts",
};

const runtimeReport = {
  config: {
    workers: 1,
    forbidOnly: true,
    projects: [{ name: "acceptance-chromium", retries: 0 }],
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
});
