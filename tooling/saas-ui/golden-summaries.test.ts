import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildGoldenSummaryInput,
  curatedPngEvidencePaths,
  assertSafeSummaryOutput,
  REQUIRED_GOLDEN_COMMANDS,
  playwrightOutputFileForCommand,
  runGoldenSummaryCommands,
  writeGoldenSummaries,
} from "./golden-summaries";
import { main as writeGoldenSummariesCli } from "./write-golden-summaries.mts";

function writeInventoryReport(
  path: string,
  file: string,
  title: string,
  projectName: string,
) {
  writeFileSync(
    path,
    JSON.stringify({
      suites: [
        {
          file,
          title: "suite",
          specs: [
            {
              title,
              tests: [{ status: "passed", projectName }],
            },
          ],
        },
      ],
    }),
  );
}

function writeInventoryForCommand(
  command: string,
  outputFile: string | undefined,
) {
  if (!outputFile) return;
  const reports: Record<
    string,
    [file: string, title: string, projectName: string]
  > = {
    "pnpm smoke:golden:browser": [
      "tests/e2e/saas-ui-golden.spec.ts",
      "browser",
      "desktop-chromium",
    ],
    "pnpm smoke:golden:a11y": [
      "tests/e2e/saas-ui-golden.accessibility.spec.ts",
      "accessibility",
      "mobile-chromium",
    ],
  };
  const report = reports[command];
  if (report) writeInventoryReport(outputFile, ...report);
}

const input = {
  generatedAt: "2026-08-12T12:00:00.000Z",
  finalHead: "d".repeat(40),
  pins: {
    template: "e".repeat(40),
    starter: "f".repeat(40),
    pro: "0".repeat(40),
  },
  generatedDigest: "1".repeat(64),
  deviations: [
    {
      source: "source.ts:thing",
      destination: "apps/web/src/thing.ts",
      change: "compatibility adjustment",
      reason: "runtime compatibility",
      evidence: "focused unit test",
      evidencePaths: ["tooling/quality/saas-ui-foundation.test.ts"],
      evidenceChecks: [
        "tooling/quality/saas-ui-foundation.test.ts#checkSaasUiFoundation",
      ],
      sourceAuthority: "factory-support",
    },
  ],
  evidencePaths: [
    "artifacts/saas-ui-golden/dashboard-reference-desktop-light.png",
  ],
  commands: [
    {
      command: "pnpm check:saas-ui-foundation",
      exitCode: 0,
      completedAt: "2026-08-12T11:59:00.000Z",
    },
  ],
} as const;

function validReceipt(repositoryRoot: string) {
  const finalHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const pins = JSON.parse(
    readFileSync(
      join(repositoryRoot, "docs/template/saas-ui-upstream.json"),
      "utf8",
    ),
  ).pins as typeof input.pins;
  const generatedDigest = (
    JSON.parse(
      readFileSync(
        join(
          repositoryRoot,
          "artifacts/saas-ui-golden/authority-generated.json",
        ),
        "utf8",
      ),
    ) as { digest: string }
  ).digest;
  const evidenceMtimes = [
    statSync(
      join(repositoryRoot, "artifacts/saas-ui-golden/authority-generated.json"),
    ).mtimeMs,
    ...curatedPngEvidencePaths(repositoryRoot).map(
      (path) => statSync(join(repositoryRoot, path)).mtimeMs,
    ),
  ];
  const startedAt = new Date(Math.min(...evidenceMtimes) - 1_000).toISOString();
  const finishedAt = new Date(Date.now() + 1_000).toISOString();
  return {
    schemaVersion: 2 as const,
    createdBy: "saas-ui:golden-summary-runner" as const,
    startedAt,
    finishedAt,
    generatedAt: finishedAt,
    finalHead,
    pins,
    generatedDigest,
    deviations: [],
    evidencePaths: [
      "artifacts/saas-ui-golden/authority-generated.json",
      ...curatedPngEvidencePaths(repositoryRoot),
    ],
    commands: REQUIRED_GOLDEN_COMMANDS.map((command) => ({
      command,
      startedAt,
      finishedAt,
      completedAt: finishedAt,
      exitCode: 0,
      result: "machine-recorded",
    })),
  };
}

describe("golden Task 12 summaries", () => {
  it("enumerates only complete curated reference/generated PNG pairs", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-png-pairs-"));
    const evidence = join(root, "artifacts/saas-ui-golden");
    mkdirSync(evidence, { recursive: true });
    for (const authority of ["reference", "generated"]) {
      writeFileSync(
        join(evidence, `dashboard-ready-${authority}-desktop-light.png`),
        "png",
      );
    }
    writeFileSync(join(evidence, "server-errors-reference.jsonl"), "raw");
    expect(curatedPngEvidencePaths(root)).toEqual([
      "artifacts/saas-ui-golden/dashboard-ready-generated-desktop-light.png",
      "artifacts/saas-ui-golden/dashboard-ready-reference-desktop-light.png",
    ]);
    unlinkSync(join(evidence, "dashboard-ready-generated-desktop-light.png"));
    expect(() => curatedPngEvidencePaths(root)).toThrow(/pair|incomplete/u);
  });

  it("writes all four summaries with pins, results, ledger, digest, and evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-test-"));
    const repositoryRoot = join(root, "repo");
    mkdirSync(join(repositoryRoot, "artifacts/saas-ui-golden"), {
      recursive: true,
    });

    writeGoldenSummaries(
      join(repositoryRoot, "artifacts/saas-ui-golden"),
      input,
      repositoryRoot,
    );

    for (const name of [
      "acceptance-summary.json",
      "deviation-summary.json",
      "interaction-summary.json",
      "accessibility-summary.json",
    ]) {
      const summary = JSON.parse(
        readFileSync(
          join(repositoryRoot, "artifacts/saas-ui-golden", name),
          "utf8",
        ),
      ) as Record<string, unknown>;
      expect(summary.schemaVersion).toBe(1);
      expect(summary.status).toBe("passed");
      expect(summary.finalHead).toBe(input.finalHead);
      expect(summary.generatedDigest).toBe(input.generatedDigest);
      expect(summary.pins).toEqual(input.pins);
      expect(summary.evidencePaths).toEqual(input.evidencePaths);
      expect(summary.commands).toEqual(input.commands);
    }

    const deviations = JSON.parse(
      readFileSync(
        join(
          repositoryRoot,
          "artifacts/saas-ui-golden",
          "deviation-summary.json",
        ),
        "utf8",
      ),
    ) as { deviations: unknown };
    expect(deviations.deviations).toEqual(input.deviations);
  });

  it("preserves a failed final command instead of fabricating a pass", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-failure-"));
    const repositoryRoot = join(root, "repo");
    mkdirSync(join(repositoryRoot, "artifacts/saas-ui-golden"), {
      recursive: true,
    });

    writeGoldenSummaries(
      join(repositoryRoot, "artifacts/saas-ui-golden"),
      {
        ...input,
        commands: [
          {
            command: "pnpm smoke:golden:a11y",
            exitCode: 1,
            completedAt: input.commands[0].completedAt,
            startedAt: input.commands[0].completedAt,
            finishedAt: input.commands[0].completedAt,
          },
        ],
      },
      repositoryRoot,
    );

    const summary = JSON.parse(
      readFileSync(
        join(
          repositoryRoot,
          "artifacts/saas-ui-golden",
          "acceptance-summary.json",
        ),
        "utf8",
      ),
    ) as { status: string };
    expect(summary.status).toBe("failed");
  });

  it("rejects absolute or temporary evidence paths", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-path-"));
    const repositoryRoot = join(root, "repo");
    mkdirSync(join(repositoryRoot, "artifacts/saas-ui-golden"), {
      recursive: true,
    });

    expect(() =>
      writeGoldenSummaries(
        join(repositoryRoot, "artifacts/saas-ui-golden"),
        {
          ...input,
          evidencePaths: ["/Users/alice/private-capture.png"],
        },
        repositoryRoot,
      ),
    ).toThrow(/repository-relative|absolute|temporary/u);
  });

  it("rejects disposable Playwright and server-error evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-disposable-"));
    const repositoryRoot = join(root, "repo");
    mkdirSync(join(repositoryRoot, "artifacts/saas-ui-golden"), {
      recursive: true,
    });
    for (const path of [
      "artifacts/saas-ui-golden/playwright/trace.zip",
      "artifacts/saas-ui-golden/server-errors-generated.jsonl",
    ])
      expect(() =>
        writeGoldenSummaries(
          join(repositoryRoot, "artifacts/saas-ui-golden"),
          { ...input, evidencePaths: [path] },
          repositoryRoot,
        ),
      ).toThrow(/evidence path|disposable|playwright|server-errors/u);
  });

  it("binds receipt summaries to the current head and authority metadata", () => {
    const repositoryRoot = process.cwd();
    const receipt = validReceipt(repositoryRoot);

    const summary = buildGoldenSummaryInput({
      repositoryRoot,
      receipt,
    });

    expect(summary.finalHead).toBe(receipt.finalHead);
    expect(summary.pins).toEqual(receipt.pins);
    expect(summary.generatedDigest).toBe(receipt.generatedDigest);
    expect(summary.commands).toEqual(receipt.commands);
  });

  it("fails closed for a stale receipt head", () => {
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: { ...validReceipt(process.cwd()), finalHead: "0".repeat(40) },
      }),
    ).toThrow(/head|stale|receipt/u);
  });

  it("executes the fixed inventory through argv arrays and records real exits", () => {
    const calls: Array<{ command: string; argv: readonly string[] }> = [];
    const receipt = runGoldenSummaryCommands(
      process.cwd(),
      ({ command, argv }) => {
        calls.push({ command, argv });
        return command === REQUIRED_GOLDEN_COMMANDS[0] ? 7 : 0;
      },
    );
    expect(calls.map(({ command }) => command)).toEqual(
      REQUIRED_GOLDEN_COMMANDS,
    );
    expect(calls[0]?.argv).toEqual(["check:saas-ui-foundation"]);
    expect(receipt.commands[0]?.exitCode).toBe(7);
    expect(receipt.commands).toHaveLength(REQUIRED_GOLDEN_COMMANDS.length);
    expect(receipt.deviations).toHaveLength(18);
  });

  it("routes only browser and accessibility commands to distinct inventories", () => {
    const root = process.cwd();
    expect(
      playwrightOutputFileForCommand("pnpm smoke:golden:browser", root),
    ).toBe(join(root, "artifacts/saas-ui-golden/interaction-results.json"));
    expect(playwrightOutputFileForCommand("pnpm smoke:golden:a11y", root)).toBe(
      join(root, "artifacts/saas-ui-golden/accessibility-results.json"),
    );
    for (const command of [
      "pnpm check:saas-ui-foundation",
      "pnpm check:saas-ui-artifact-safety",
      "pnpm --dir tooling/generators test -- saasFrontendFoundation.test.ts saasFrontendGeneratedTarget.test.ts",
      "pnpm smoke:golden:visual",
    ]) {
      expect(playwrightOutputFileForCommand(command, root)).toBeUndefined();
    }
  });

  it("does not reuse a prior inventory when its producing command fails", () => {
    const root = process.cwd();
    const calls: Array<{ command: string; outputFile?: string }> = [];
    const receipt = runGoldenSummaryCommands(
      root,
      ({ command, outputFile }) => {
        calls.push({ command, outputFile });
        return command === "pnpm smoke:golden:browser" ? 1 : 0;
      },
    );
    expect(
      calls.find(({ command }) => command === "pnpm smoke:golden:browser"),
    ).toMatchObject({
      outputFile: join(
        root,
        "artifacts/saas-ui-golden/interaction-results.json",
      ),
    });
    expect(
      calls.find(({ command }) => command === "pnpm smoke:golden:visual"),
    ).toEqual({ command: "pnpm smoke:golden:visual", outputFile: undefined });
    expect(receipt.resultInventories).toBeUndefined();
  });

  it("keeps browser and accessibility inventories bound to their own suites", () => {
    const root = process.cwd();
    const interactionPath = join(
      root,
      "artifacts/saas-ui-golden/interaction-results.json",
    );
    const accessibilityPath = join(
      root,
      "artifacts/saas-ui-golden/accessibility-results.json",
    );
    try {
      const receipt = runGoldenSummaryCommands(
        root,
        ({ command, outputFile }) => {
          writeInventoryForCommand(command, outputFile);
          return 0;
        },
      );
      expect(receipt.resultInventories).toMatchObject({
        interaction: [
          {
            file: "tests/e2e/saas-ui-golden.spec.ts",
            project: "desktop-chromium",
          },
        ],
        accessibility: [
          {
            file: "tests/e2e/saas-ui-golden.accessibility.spec.ts",
            project: "mobile-chromium",
          },
        ],
      });
    } finally {
      for (const path of [interactionPath, accessibilityPath]) {
        try {
          unlinkSync(path);
        } catch {
          // The focused test may have no output for a command.
        }
      }
    }
  });

  it("rejects garbage and out-of-bounds timestamps", () => {
    const receipt = validReceipt(process.cwd());
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: { ...receipt, generatedAt: "not-a-date" },
      }),
    ).toThrow(/timestamp|ISO|finite/u);
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: {
          ...receipt,
          commands: receipt.commands.map((command, index) =>
            index === 0
              ? { ...command, startedAt: "1999-01-01T00:00:00.000Z" }
              : command,
          ),
        },
      }),
    ).toThrow(/outside|timestamp|run/u);

    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: {
          ...receipt,
          commands: receipt.commands.map((command, index) =>
            index === 0
              ? { ...command, completedAt: "1999-01-01T00:00:00.000Z" }
              : command,
          ),
        },
      }),
    ).toThrow(/outside|timestamp|run/u);
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: {
          ...receipt,
          commands: receipt.commands.map((command, index) =>
            index === 0
              ? { ...command, completedAt: "2999-01-01T00:00:00.000Z" }
              : command,
          ),
        },
      }),
    ).toThrow(/outside|timestamp|run/u);
  });

  it("rejects fake command receipts and nonexistent evidence", () => {
    const receipt = validReceipt(process.cwd());
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: {
          ...receipt,
          evidencePaths: ["artifacts/saas-ui-golden/missing.png"],
          commands: receipt.commands.map((command, index) =>
            index === 0 ? { ...command, command: "echo fake" } : command,
          ),
        },
      }),
    ).toThrow(/command|evidence|exist/u);
  });

  it("rejects evidence that was not fresh during the receipt run", () => {
    const receipt = validReceipt(process.cwd());
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: {
          ...receipt,
          startedAt: "2000-01-01T00:00:00.000Z",
          finishedAt: "2000-01-01T00:00:01.000Z",
          commands: receipt.commands.map((command) => ({
            ...command,
            startedAt: "2000-01-01T00:00:00.000Z",
            finishedAt: "2000-01-01T00:00:01.000Z",
          })),
        },
      }),
    ).toThrow(/fresh|run|timestamp/u);
  });

  it("rejects stale curated PNG evidence", () => {
    const repositoryRoot = process.cwd();
    const receipt = validReceipt(repositoryRoot);
    const png = curatedPngEvidencePaths(repositoryRoot)[0];
    if (!png) throw new Error("expected committed curated PNG evidence");
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot,
        receipt: {
          ...receipt,
          evidencePaths: [...receipt.evidencePaths, png],
          startedAt: "2000-01-01T00:00:00.000Z",
          finishedAt: "2000-01-01T00:00:01.000Z",
          commands: receipt.commands.map((command) => ({
            ...command,
            startedAt: "2000-01-01T00:00:00.000Z",
            finishedAt: "2000-01-01T00:00:01.000Z",
            completedAt: "2000-01-01T00:00:01.000Z",
          })),
        },
      }),
    ).toThrow(/fresh|run|timestamp/u);
  });

  it("rejects old receipt and output override CLI arguments", () => {
    expect(() => writeGoldenSummariesCli(["--receipt", "old.json"])).toThrow(
      /Usage/u,
    );
    expect(() =>
      writeGoldenSummariesCli(["--output-root", "/tmp/out"]),
    ).toThrow(/Usage/u);
  });

  it("rejects symlinked fixed output directories and summary files", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-symlink-"));
    const repositoryRoot = join(root, "repo");
    const outside = join(root, "outside");
    mkdirSync(outside, { recursive: true });
    mkdirSync(repositoryRoot, { recursive: true });
    const output = join(repositoryRoot, "artifacts/saas-ui-golden");
    mkdirSync(join(repositoryRoot, "artifacts"), { recursive: true });
    execFileSync("ln", ["-s", outside, output]);
    expect(() => assertSafeSummaryOutput(repositoryRoot, output)).toThrow(
      /symlink/u,
    );

    unlinkSync(output);
    mkdirSync(output, { recursive: true });
    execFileSync("ln", [
      "-s",
      join(outside, "summary.json"),
      join(output, "acceptance-summary.json"),
    ]);
    expect(() => assertSafeSummaryOutput(repositoryRoot, output)).toThrow(
      /symlink/u,
    );
  });
});
