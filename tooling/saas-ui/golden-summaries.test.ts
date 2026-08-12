import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildGoldenSummaryInput,
  assertSafeSummaryOutput,
  REQUIRED_GOLDEN_COMMANDS,
  runGoldenSummaryCommands,
  writeGoldenSummaries,
} from "./golden-summaries";
import { main as writeGoldenSummariesCli } from "./write-golden-summaries.mts";

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
  const evidenceMtime = statSync(
    join(repositoryRoot, "artifacts/saas-ui-golden/authority-generated.json"),
  ).mtimeMs;
  const startedAt = new Date(evidenceMtime - 1_000).toISOString();
  const finishedAt = new Date(evidenceMtime + 1_000).toISOString();
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
    evidencePaths: ["artifacts/saas-ui-golden/authority-generated.json"],
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
