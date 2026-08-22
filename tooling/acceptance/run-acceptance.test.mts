import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  escapedTagPattern,
  parseAcceptanceArguments,
  renderBoundedPlaywrightProcessOutput,
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

const configFor = (sourceRoot = "/fixture") =>
  ({
    rootDir: `${sourceRoot}/tests/acceptance`,
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
        testDir: `${sourceRoot}/tests/acceptance`,
        testMatch: "**/*.spec.ts",
      },
    ],
  }) as const;

type Fixture = {
  readonly id: string;
  readonly file?: string;
  readonly title?: string;
  readonly tag: string;
  readonly status?: string;
  readonly expectedStatus?: string;
  readonly retry?: number;
  readonly error?: string;
  readonly annotations?: readonly { readonly type: string }[];
};

const rawNativeReport = (
  fixtures: readonly Fixture[],
  sourceRoot?: string,
) => ({
  config: configFor(sourceRoot),
  suites: [
    {
      file: "tests/acceptance/records.spec.ts",
      specs: fixtures.map((fixture) => ({
        id: fixture.id,
        file: fixture.file ?? "tests/acceptance/records.spec.ts",
        title: fixture.title ?? fixture.id,
        tags: [
          fixture.tag.startsWith("@") ? fixture.tag.slice(1) : fixture.tag,
        ],
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
                      ...(fixture.error === undefined
                        ? {}
                        : { errors: [{ message: fixture.error }] }),
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

const shellQuoted = (value: string): string =>
  `'${value.replaceAll("'", "'\"'\"'")}'`;

const writeRequiredContract = async (root: string): Promise<void> => {
  await mkdir(join(root, "source", "tests", "acceptance"), {
    recursive: true,
  });
  await writeFile(
    join(root, "source", "tests", "acceptance", "records.spec.ts"),
    "",
  );
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
};

const initializeGitCheckout = (sourceRoot: string): void => {
  execFileSync("git", ["init", "--quiet"], { cwd: sourceRoot });
  execFileSync("git", ["config", "user.email", "acceptance@example.test"], {
    cwd: sourceRoot,
  });
  execFileSync("git", ["config", "user.name", "Acceptance Test"], {
    cwd: sourceRoot,
  });
  execFileSync("git", ["add", "."], { cwd: sourceRoot });
  execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "initial"],
    { cwd: sourceRoot },
  );
};

const writeDefaultRunnerPnpm = async (input: {
  readonly root: string;
  readonly chunks: readonly string[];
}): Promise<string> => {
  const bin = join(input.root, "bin");
  await mkdir(bin);
  const sourceRoot = join(input.root, "source");
  const discovery = JSON.stringify(
    rawNativeReport([{ id: "required", tag: "@BHV-REC-001-R1" }], sourceRoot),
  );
  const runtime = JSON.stringify(
    rawNativeReport(
      [
        {
          id: "required",
          tag: "@BHV-REC-001-R1",
          status: "passed",
        },
      ],
      sourceRoot,
    ),
  );
  const script = [
    "#!/bin/sh",
    'case "$*" in',
    `*--list*) printf %s ${shellQuoted(discovery)} > "$PLAYWRIGHT_JSON_OUTPUT_NAME"; exit 0 ;;`,
    "esac",
    `printf %s ${shellQuoted(runtime)} > "$PLAYWRIGHT_JSON_OUTPUT_NAME"`,
    ...input.chunks.flatMap((chunk) => [
      `printf %s ${shellQuoted(chunk)} >&2`,
      "sleep 0.1",
    ]),
    "exit 1",
  ].join("\n");
  await writeFile(join(bin, "pnpm"), script);
  await chmod(join(bin, "pnpm"), 0o755);
  return bin;
};

const defaultRunnerFailure = async (input: {
  readonly root: string;
  readonly chunks: readonly string[];
}): Promise<string> => {
  const repoRoot = await realpath(input.root);
  const bin = await writeDefaultRunnerPnpm({ ...input, root: repoRoot });
  initializeGitCheckout(join(repoRoot, "source"));
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}:${previousPath ?? ""}`;
  try {
    await runAcceptance({
      repoRoot,
      sourceRoot: "source",
      scope: "required",
    });
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    process.env.PATH = previousPath;
  }
};

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
  it.each([
    "Authorization: Basic authorization-colon-canary",
    "AUTHORIZATION=Basic authorization-equals-canary",
    "Cookie: session=cookie-colon-canary",
    "COOKIE=session=cookie-equals-canary",
    "Set-Cookie: session=set-cookie-colon-canary",
    "set-cookie=session=set-cookie-equals-canary",
    "Basic basic-canary",
    "Bearer bearer-canary",
    JSON.stringify({ Authorization: "Basic authorization-json-canary" }),
    JSON.stringify({ Cookie: "cookie-json-canary" }),
    JSON.stringify({ "Set-Cookie": "set-cookie-json-canary" }),
  ])("redacts credential output %s", (input) => {
    const output = renderBoundedPlaywrightProcessOutput(input);
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("-canary");
  });

  it("redacts a header before the default runner tail discards its key", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-tail-"));
    roots.push(root);
    await writeRequiredContract(root);
    const header = "Authorization: Basic header-tail-canary ";
    const witness = "safe header witness";
    const safeTail = `\n${witness}`;
    const message = await defaultRunnerFailure({
      root,
      chunks: [
        `${header}${"x".repeat(20_000 - safeTail.length - 20)}${safeTail}`,
      ],
    });
    expect(message).toContain(witness);
    expect(message).not.toContain("header-tail-canary");
  });

  it("redacts a JSON key before the default runner tail discards it", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-json-tail-"));
    roots.push(root);
    await writeRequiredContract(root);
    const key = '"Authorization":"json-tail-canary"';
    const witness = "safe JSON witness";
    const message = await defaultRunnerFailure({
      root,
      chunks: [`${key}${"y".repeat(20_000 - witness.length - 20)}${witness}`],
    });
    expect(message).toContain(witness);
    expect(message).not.toContain("json-tail-canary");
  });

  it("redacts a header split across default runner stream chunks", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-stream-"));
    roots.push(root);
    await writeRequiredContract(root);
    const message = await defaultRunnerFailure({
      root,
      chunks: [
        "x".repeat(20_000),
        "Authorization",
        "=Basic stream-split-canary\nsafe stream witness",
      ],
    });
    expect(message).toContain("safe stream witness");
    expect(message).not.toContain("stream-split-canary");
  });

  it("accepts only the strict projected CLI grammar", () => {
    expect(
      parseAcceptanceArguments(["required", "--source-root", "."]),
    ).toEqual({
      scope: "required",
      sourceRoot: ".",
    });
    expect(parseAcceptanceArguments(["all", "--source-root", "."])).toEqual({
      scope: "all",
      sourceRoot: ".",
    });
    for (const argv of [
      [],
      ["required"],
      ["--source-root", ".", "required"],
      ["required", "--source-root", ".", "--source-root", "."],
      ["required", "--unknown", "."],
      ["required", "--source-root", "seed/source"],
    ]) {
      expect(() => parseAcceptanceArguments(argv)).toThrow();
    }
  });

  it("rejects invalid CLI input through the real tsx entrypoint", () => {
    expect(() =>
      execFileSync(
        "pnpm",
        [
          "exec",
          "tsx",
          "tooling/acceptance/run-acceptance.mts",
          "invalid",
          "--source-root",
          ".",
        ],
        { cwd: process.cwd(), stdio: "pipe" },
      ),
    ).toThrow();
  });

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
    ["file", { file: "tests/acceptance/other.spec.ts" }],
    ["title", { title: "different title" }],
    ["behavior tag", { tag: "@BHV-REC-999-R1" }],
  ] as const)("rejects a runtime %s identity mismatch", (_field, change) => {
    expect(
      validateAcceptanceRuntime({
        ...passInput,
        runtime: nativeReport([
          {
            id: "required",
            tag: "@BHV-REC-001-R1",
            status: "passed",
            ...change,
          },
        ]),
      }).join("\n"),
    ).toMatch(/identity|file|title|tag/i);
  });

  it("rejects duplicate discovery IDs", () => {
    expect(
      validateAcceptanceRuntime({
        ...passInput,
        discovered: nativeReport([
          { id: "required", tag: "@BHV-REC-001-R1" },
          { id: "required", tag: "@BHV-REC-001-R1" },
        ]),
      }).join("\n"),
    ).toMatch(/duplicate|identity/i);
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
  it("rejects a root checkout mutation when nested discovery throws", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "maestro-acceptance-root-checkout-"),
    );
    roots.push(root);
    await writeRequiredContract(root);
    await writeFile(join(root, "README.md"), "original\n");
    initializeGitCheckout(root);

    await expect(
      runAcceptance({
        repoRoot: root,
        sourceRoot: "source",
        scope: "required",
        processRunner: async () => {
          execFileSync(
            "git",
            ["update-index", "--assume-unchanged", "README.md"],
            {
              cwd: root,
            },
          );
          await writeFile(join(root, "README.md"), "counterfeit\n");
          execFileSync(
            "git",
            ["config", "core.worktree", join(root, "redirected")],
            {
              cwd: root,
            },
          );
          throw new Error("native discovery failed");
        },
      }),
    ).rejects.toThrow(/checkout.*source mutation.*discovery/i);
  });

  it("rejects a checkout mutation when runtime is nonzero with invalid JSON", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "maestro-acceptance-runtime-failure-"),
    );
    roots.push(root);
    await writeRequiredContract(root);
    await writeFile(join(root, "README.md"), "original\n");
    initializeGitCheckout(root);

    await expect(
      runAcceptance({
        repoRoot: root,
        sourceRoot: "source",
        scope: "required",
        processRunner: async (args, environment) => {
          if (args.includes("--list")) {
            await writeFile(
              environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
              JSON.stringify(
                rawNativeReport(
                  [{ id: "required", tag: "@BHV-REC-001-R1" }],
                  join(root, "source"),
                ),
              ),
            );
            return { exitCode: 0, stdout: "", stderr: "" };
          }
          execFileSync(
            "git",
            ["update-index", "--assume-unchanged", "README.md"],
            {
              cwd: root,
            },
          );
          await writeFile(join(root, "README.md"), "counterfeit\n");
          execFileSync(
            "git",
            ["config", "core.worktree", join(root, "redirected")],
            {
              cwd: root,
            },
          );
          await writeFile(
            environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
            "not JSON",
          );
          return { exitCode: 1, stdout: "", stderr: "native failure" };
        },
      }),
    ).rejects.toThrow(/checkout.*source mutation.*runtime/i);
  });

  it.each([
    ["assume-unchanged", "--assume-unchanged"],
    ["skip-worktree", "--skip-worktree"],
  ])(
    "rejects a hidden %s checkout mutation before discovery",
    async (_name, flag) => {
      const root = await mkdtemp(
        join(tmpdir(), "maestro-acceptance-checkout-"),
      );
      roots.push(root);
      await writeRequiredContract(root);
      const sourceRoot = join(root, "source");
      execFileSync("git", ["init", "--quiet"], { cwd: sourceRoot });
      execFileSync("git", ["config", "user.email", "acceptance@example.test"], {
        cwd: sourceRoot,
      });
      execFileSync("git", ["config", "user.name", "Acceptance Test"], {
        cwd: sourceRoot,
      });
      execFileSync("git", ["add", "."], { cwd: sourceRoot });
      execFileSync(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "commit",
          "--quiet",
          "-m",
          "initial acceptance",
        ],
        { cwd: sourceRoot },
      );
      execFileSync(
        "git",
        ["update-index", flag, "tests/acceptance/records.spec.ts"],
        { cwd: sourceRoot },
      );
      await writeFile(
        join(sourceRoot, "tests", "acceptance", "records.spec.ts"),
        "counterfeit",
      );
      const processRunner = vi.fn(
        async (
          args: readonly string[],
          environment: Readonly<Record<string, string>>,
        ): Promise<PlaywrightProcessResult> => {
          const discovery = args.includes("--list");
          await writeFile(
            environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
            JSON.stringify(
              rawNativeReport(
                [
                  {
                    id: "required",
                    tag: "@BHV-REC-001-R1",
                    ...(discovery ? {} : { status: "passed" }),
                  },
                ],
                sourceRoot,
              ),
            ),
          );
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      );

      await expect(
        runAcceptance({
          repoRoot: root,
          sourceRoot: "source",
          scope: "required",
          processRunner,
        }),
      ).rejects.toThrow(/could not capture Git checkout state/i);
      expect(processRunner).not.toHaveBeenCalled();
    },
  );

  it("rejects a checkout/source mutation during runtime", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "maestro-acceptance-runtime-mutation-"),
    );
    roots.push(root);
    await writeRequiredContract(root);
    const sourceRoot = join(root, "source");
    initializeGitCheckout(sourceRoot);
    const processRunner = vi.fn(
      async (
        args: readonly string[],
        environment: Readonly<Record<string, string>>,
      ): Promise<PlaywrightProcessResult> => {
        const discovery = args.includes("--list");
        await writeFile(
          environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
          JSON.stringify(
            rawNativeReport(
              [
                {
                  id: "required",
                  tag: "@BHV-REC-001-R1",
                  ...(discovery ? {} : { status: "passed" }),
                },
              ],
              sourceRoot,
            ),
          ),
        );
        if (!discovery)
          await writeFile(
            join(sourceRoot, "tests", "acceptance", "records.spec.ts"),
            "counterfeit",
          );
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    );

    await expect(
      runAcceptance({
        repoRoot: root,
        sourceRoot: "source",
        scope: "required",
        processRunner,
      }),
    ).rejects.toThrow(/checkout.*source mutation.*runtime/i);
    expect(processRunner).toHaveBeenCalledTimes(2);
  });

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
    initializeGitCheckout(join(root, "source"));
    const writeOutput = vi.fn<(output: string) => void>();
    const processRunner = vi.fn(
      async (
        args: readonly string[],
        environment: Readonly<Record<string, string>>,
      ): Promise<PlaywrightProcessResult> => {
        const report = args.includes("--list")
          ? rawNativeReport(
              [
                { id: "required", tag: "@BHV-REC-001-R1" },
                { id: "draft", tag: "@BHV-REC-002-R1" },
              ],
              join(root, "source"),
            )
          : rawNativeReport(
              args.includes("--grep")
                ? [
                    {
                      id: "required",
                      tag: "@BHV-REC-001-R1",
                      status: "passed",
                    },
                  ]
                : [
                    {
                      id: "required",
                      tag: "@BHV-REC-001-R1",
                      status: "passed",
                    },
                    {
                      id: "draft",
                      tag: "@BHV-REC-002-R1",
                      status: "passed",
                    },
                  ],
              join(root, "source"),
            );
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

    const allOutput = vi.fn<(output: string) => void>();
    await runAcceptance({
      repoRoot: root,
      sourceRoot: "source",
      scope: "all",
      writeOutput: allOutput,
      processRunner,
    });
    expect(allOutput).toHaveBeenCalledWith("2 selected, 2 runtime");

    await expect(
      runAcceptance({
        repoRoot: root,
        sourceRoot: "source",
        scope: "required",
        processRunner: async (args, environment) => {
          const report = rawNativeReport(
            [
              {
                id: "required",
                tag: "@BHV-REC-001-R1",
                ...(args.includes("--list") ? {} : { status: "passed" }),
              },
            ],
            args.includes("--list")
              ? join(root, "source")
              : join(root, "source", "tests", "unit"),
          );
          await writeFile(
            environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
            JSON.stringify(report),
          );
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      }),
    ).rejects.toThrow(/rootDir|testDir/i);
  });

  it("reports the selected behavior, title, and bounded native failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-failure-"));
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
    title: Required record is saved
    actor: member
    surfaces: [web-ui]
    preconditions: []
    action: save
    outcomes: [listed]
`,
    );
    initializeGitCheckout(join(root, "source"));
    const nativeFailure = `generated CLI title is missing Bearer bearer-canary API_TOKEN=token-canary ${"x".repeat(600)} final preflight witness SERVICE_PASSWORD=password-canary`;
    const failure = runAcceptance({
      repoRoot: root,
      sourceRoot: "source",
      scope: "required",
      processRunner: async (args, environment) => {
        const report = rawNativeReport(
          args.includes("--list")
            ? [
                {
                  id: "required",
                  tag: "@BHV-REC-001-R1",
                  title: "Required record is saved",
                },
              ]
            : [
                {
                  id: "required",
                  tag: "@BHV-REC-001-R1",
                  title: "Required record is saved",
                  status: "failed",
                  error: nativeFailure,
                },
              ],
          join(root, "source"),
        );
        await writeFile(
          environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
          JSON.stringify(report),
        );
        return {
          exitCode: args.includes("--list") ? 0 : 1,
          stdout: "",
          stderr: "",
        };
      },
    });
    let message = "";
    try {
      await failure;
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("@BHV-REC-001-R1");
    expect(message).toContain("Required record is saved");
    expect(message).toContain("generated CLI title is missing");
    expect(message).toContain("final preflight witness");
    expect(message).not.toContain("bearer-canary");
    expect(message).not.toContain("token-canary");
    expect(message).not.toContain("password-canary");
    const native = message.match(/native error: (.+)$/u)?.[1];
    expect(native).toBeDefined();
    expect(native?.length).toBeLessThanOrEqual(500);
    expect(native?.split("…")).toHaveLength(2);
  });

  it("redacts and bounds injected Playwright stderr", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-stderr-"));
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
    title: Required record is saved
    actor: member
    surfaces: [web-ui]
    preconditions: []
    action: save
    outcomes: [listed]
`,
    );
    initializeGitCheckout(join(root, "source"));
    const jsonHeaders = JSON.stringify({
      Authorization: "Basic auth-json-canary",
      Cookie: 'session="json-cookie-canary"',
    });
    const stderr = `initial runner context
Authorization: Basic authorization-canary
Cookie: session=cookie-canary
apiKey=key-canary "client_secret":"secret-canary" "X-API-KEY":"hyphen-canary"
${jsonHeaders}
${"x".repeat(700)} final native witness`;
    const failure = runAcceptance({
      repoRoot: root,
      sourceRoot: "source",
      scope: "required",
      processRunner: async (args, environment) => {
        const report = rawNativeReport(
          [
            {
              id: "required",
              tag: "@BHV-REC-001-R1",
              title: "Required record is saved",
            },
          ],
          join(root, "source"),
        );
        await writeFile(
          environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
          JSON.stringify(report),
        );
        return {
          exitCode: args.includes("--list") ? 0 : 1,
          stdout: "",
          stderr: args.includes("--list") ? "" : stderr,
        };
      },
    });
    let message = "";
    try {
      await failure;
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("native stderr:");
    expect(message).toContain("Authorization: [REDACTED]");
    expect(message).toContain("Cookie: [REDACTED]");
    expect(message).toContain("apiKey=[REDACTED]");
    expect(message).toContain("client_secret=[REDACTED]");
    expect(message).toContain("X-API-KEY=[REDACTED]");
    expect(message).toContain("initial runner context");
    expect(message).toContain("final native witness");
    expect(message).not.toContain("authorization-canary");
    expect(message).not.toContain("cookie-canary");
    expect(message).not.toContain("key-canary");
    expect(message).not.toContain("secret-canary");
    expect(message).not.toContain("hyphen-canary");
    expect(message).not.toContain("auth-json-canary");
    expect(message).not.toContain("json-cookie-canary");
    const native = message.match(/native stderr: (.+)$/u)?.[1];
    expect(native).toBeDefined();
    expect(native?.length).toBeLessThanOrEqual(500);
    expect(native?.split("…")).toHaveLength(2);
  });

  it("fails closed when stdout has JSON but the isolated report file is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-acceptance-no-report-"));
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
    initializeGitCheckout(join(root, "source"));
    const reportPaths: string[] = [];
    const validJson = JSON.stringify(rawNativeReport([], join(root, "source")));
    const rejection = expect(
      runAcceptance({
        repoRoot: root,
        sourceRoot: "source",
        scope: "required",
        processRunner: vi.fn(async (_args, environment) => {
          reportPaths.push(environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string);
          if (_args.includes("--list"))
            await writeFile(
              environment.PLAYWRIGHT_JSON_OUTPUT_NAME as string,
              validJson,
            );
          return {
            exitCode: 0,
            stdout: validJson,
            stderr: "native stderr",
          };
        }),
      }),
    ).rejects;
    await rejection.toThrow(/Playwright JSON report|report/i);
    await rejection.toThrow(/native stderr/);
    await expect(access(dirname(reportPaths[0] as string))).rejects.toThrow();
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
