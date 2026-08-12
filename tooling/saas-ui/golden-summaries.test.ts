import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildGoldenSummaryInput,
  REQUIRED_GOLDEN_COMMANDS,
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
    generatedAt: new Date().toISOString(),
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

    writeGoldenSummaries(root, input);

    for (const name of [
      "acceptance-summary.json",
      "deviation-summary.json",
      "interaction-summary.json",
      "accessibility-summary.json",
    ]) {
      const summary = JSON.parse(
        readFileSync(join(root, name), "utf8"),
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
      readFileSync(join(root, "deviation-summary.json"), "utf8"),
    ) as { deviations: unknown };
    expect(deviations.deviations).toEqual(input.deviations);
  });

  it("preserves a failed final command instead of fabricating a pass", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-failure-"));

    writeGoldenSummaries(root, {
      ...input,
      commands: [
        {
          command: "pnpm smoke:golden:a11y",
          exitCode: 1,
          completedAt: input.commands[0].completedAt,
        },
      ],
    });

    const summary = JSON.parse(
      readFileSync(join(root, "acceptance-summary.json"), "utf8"),
    ) as { status: string };
    expect(summary.status).toBe("failed");
  });

  it("rejects absolute or temporary evidence paths", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-summary-path-"));

    expect(() =>
      writeGoldenSummaries(root, {
        ...input,
        evidencePaths: ["/Users/alice/private-capture.png"],
      }),
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

  it("has an executable caller that writes only the four required summaries", () => {
    const repositoryRoot = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "golden-summary-cli-"));
    const receiptPath = join(root, "receipt.json");
    writeFileSync(
      receiptPath,
      `${JSON.stringify(validReceipt(repositoryRoot))}\n`,
    );

    writeGoldenSummariesCli(["--receipt", receiptPath]);

    expect(
      readdirSync(resolve(repositoryRoot, "artifacts/saas-ui-golden"))
        .filter((name) => name.endsWith("-summary.json"))
        .sort(),
    ).toEqual([
      "acceptance-summary.json",
      "accessibility-summary.json",
      "deviation-summary.json",
      "interaction-summary.json",
    ]);

    expect(() =>
      writeGoldenSummariesCli([
        "--receipt",
        receiptPath,
        "--output-root",
        root,
      ]),
    ).toThrow(/Usage|receipt/u);
    for (const name of [
      "acceptance-summary.json",
      "accessibility-summary.json",
      "deviation-summary.json",
      "interaction-summary.json",
    ])
      unlinkSync(resolve(repositoryRoot, "artifacts/saas-ui-golden", name));
  });
});
