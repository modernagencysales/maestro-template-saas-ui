import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  escapedTagPattern,
  requiredBehaviorTags,
  runAcceptance,
  validateAcceptanceRuntime,
  type PlaywrightProcessResult,
} from "./run-acceptance.mts";
import { parsePlaywrightJsonReport } from "./playwright-report.mts";
import type { ParsedPlaywrightJsonReport } from "./playwright-report.mts";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true });
});

const config = {
  workers: 1,
  forbidOnly: true,
  projects: [{ name: "acceptance-chromium", retries: 0 }],
} as const;

type Fixture = {
  readonly id: string;
  readonly tag: string;
  readonly status?: string;
  readonly expectedStatus?: string;
  readonly retry?: number;
  readonly annotations?: readonly { readonly type: string }[];
};

const rawNativeReport = (fixtures: readonly Fixture[]) => ({
  config,
  suites: [
    {
      file: "tests/acceptance/records.spec.ts",
      specs: fixtures.map((fixture) => ({
        id: fixture.id,
        file: "tests/acceptance/records.spec.ts",
        title: fixture.id,
        tags: [fixture.tag],
        tests: [
          {
            projectName: "acceptance-chromium",
            expectedStatus: fixture.expectedStatus ?? "passed",
            annotations: fixture.annotations ?? [],
            results:
              fixture.status === undefined
                ? []
                : [
                    {
                      status: fixture.status,
                      retry: fixture.retry ?? 0,
                    },
                  ],
          },
        ],
      })),
    },
  ],
});

const nativeReport = (
  fixtures: readonly Fixture[],
): ParsedPlaywrightJsonReport =>
  parsePlaywrightJsonReport(rawNativeReport(fixtures));

const passInput = {
  requiredTags: ["@BHV-REC-001-R1"],
  discovered: nativeReport([
    { id: "required", tag: "@BHV-REC-001-R1", status: "passed" },
  ]),
  runtime: nativeReport([
    { id: "required", tag: "@BHV-REC-001-R1", status: "passed" },
  ]),
  processExitCode: 0,
};

describe("acceptance runtime validation", () => {
  it("derives only current required revision tags and escapes one grep", () => {
    expect(
      requiredBehaviorTags({
        schemaVersion: 1,
        product: { id: "records", name: "Records", summary: "Records" },
        behaviors: [
          {
            id: "BHV-REC-001",
            revision: 2,
            status: "required",
            title: "Required",
            actor: "member",
            surfaces: ["web-ui"],
            preconditions: [],
            action: "save",
            outcomes: ["listed"],
          },
          {
            id: "BHV-REC-002",
            revision: 1,
            status: "draft",
            title: "Draft",
            actor: "member",
            surfaces: ["web-ui"],
            preconditions: [],
            action: "save",
            outcomes: ["listed"],
          },
        ],
      }),
    ).toEqual(["@BHV-REC-001-R2"]);
    expect(escapedTagPattern(["@BHV-REC-001-R2", "@BHV-REC-002-R1"])).toBe(
      "(?:@BHV-REC-001-R2|@BHV-REC-002-R1)",
    );
  });

  it("accepts exactly one passed first-attempt result", () => {
    expect(validateAcceptanceRuntime(passInput)).toEqual([]);
  });

  it.each([
    [
      "missing required result",
      { ...passInput, runtime: nativeReport([]) },
      /missing/i,
    ],
    [
      "skipped result",
      {
        ...passInput,
        runtime: nativeReport([
          {
            id: "required",
            tag: "@BHV-REC-001-R1",
            status: "skipped",
            annotations: [{ type: "skip" }],
          },
        ]),
      },
      /skipped/i,
    ],
    [
      "expected failure result",
      {
        ...passInput,
        runtime: nativeReport([
          {
            id: "required",
            tag: "@BHV-REC-001-R1",
            status: "failed",
            expectedStatus: "failed",
            annotations: [{ type: "fail" }],
          },
        ]),
      },
      /expected status/i,
    ],
    [
      "flaky retry result",
      {
        ...passInput,
        runtime: nativeReport([
          {
            id: "required",
            tag: "@BHV-REC-001-R1",
            status: "passed",
            retry: 1,
          },
        ]),
      },
      /flaky|retry/i,
    ],
    [
      "unselected runtime test",
      {
        ...passInput,
        runtime: nativeReport([
          { id: "draft", tag: "@BHV-REC-002-R1", status: "passed" },
        ]),
      },
      /selection/i,
    ],
  ] as const)(
    "rejects %s even with process exit 0",
    (_name, input, pattern) => {
      expect(validateAcceptanceRuntime(input).join("\n")).toMatch(pattern);
    },
  );

  it("rejects a nonzero Playwright process even when its report passes", () => {
    expect(
      validateAcceptanceRuntime({ ...passInput, processExitCode: 1 }).join(
        "\n",
      ),
    ).toMatch(/exit/i);
  });
});

describe("runAcceptance", () => {
  it("executes discovery and the current required grep against native reports", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-runtime-"));
    roots.push(root);
    await mkdir(join(root, "source"));
    await writeFile(
      join(root, "source", "product.contract.yaml"),
      `schemaVersion: 1
product:
  id: records
  name: Records
  summary: Records
behaviors:
  - id: BHV-REC-001
    revision: 1
    status: required
    title: Required
    actor: member
    surfaces: [web-ui]
    preconditions: []
    action: save
    outcomes: [listed]
`,
    );
    const writeOutput = vi.fn<(output: string) => void>();
    const processRunner = vi.fn(
      async (
        args: readonly string[],
        environment: Readonly<Record<string, string>>,
      ): Promise<PlaywrightProcessResult> => {
        const report = args.includes("--list")
          ? rawNativeReport([
              { id: "required", tag: "@BHV-REC-001-R1" },
              { id: "draft", tag: "@BHV-REC-002-R1" },
            ])
          : rawNativeReport([
              {
                id: "required",
                tag: "@BHV-REC-001-R1",
                status: "passed",
              },
            ]);
        await writeFile(
          environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
          JSON.stringify(report),
        );
        return { exitCode: 0, stdout: "application log\n", stderr: "" };
      },
    );

    await runAcceptance({
      repoRoot: root,
      sourceRoot: "source",
      scope: "required",
      writeOutput,
      processRunner,
    });
    expect(processRunner).toHaveBeenCalledTimes(2);
    expect(processRunner.mock.calls[1]?.[0]).toContain("--grep");
    expect(writeOutput).toHaveBeenCalledWith("1 required, 1 runtime");
  });

  it("reports draft-only required scope without spawning Playwright", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-draft-"));
    roots.push(root);
    await mkdir(join(root, "source"));
    await writeFile(
      join(root, "source", "product.contract.yaml"),
      `schemaVersion: 1
product:
  id: records
  name: Records
  summary: Records
behaviors:
  - id: BHV-REC-001
    revision: 1
    status: draft
    title: Draft
    actor: member
    surfaces: [web-ui]
    preconditions: []
    action: save
    outcomes: [listed]
`,
    );
    const writeOutput = vi.fn<(output: string) => void>();
    const playwrightSpawn =
      vi.fn<
        (
          args: readonly string[],
          env: Readonly<Record<string, string>>,
        ) => Promise<PlaywrightProcessResult>
      >();

    await expect(
      runAcceptance({
        repoRoot: root,
        sourceRoot: "source",
        scope: "required",
        writeOutput,
        processRunner: playwrightSpawn,
      }),
    ).resolves.toBeUndefined();
    expect(writeOutput).toHaveBeenCalledWith(
      expect.stringMatching(/0 required.*0 runtime/iu),
    );
    expect(playwrightSpawn).not.toHaveBeenCalled();
  });
});
