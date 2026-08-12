import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildGoldenSummaryInput,
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
    const finalHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
    const pins = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, "docs/template/saas-ui-upstream.json"),
        "utf8",
      ),
    ).pins as typeof input.pins;
    const generatedDigest = (
      JSON.parse(
        readFileSync(
          resolve(
            repositoryRoot,
            "artifacts/saas-ui-golden/authority-generated.json",
          ),
          "utf8",
        ),
      ) as { digest: string }
    ).digest;

    const summary = buildGoldenSummaryInput({
      repositoryRoot,
      receipt: {
        schemaVersion: 1,
        generatedAt: input.generatedAt,
        finalHead,
        pins,
        generatedDigest,
        deviations: [],
        evidencePaths: input.evidencePaths,
        commands: input.commands,
      },
    });

    expect(summary.finalHead).toBe(finalHead);
    expect(summary.pins).toEqual(pins);
    expect(summary.generatedDigest).toBe(generatedDigest);
    expect(summary.commands).toEqual(input.commands);
  });

  it("fails closed for a stale receipt head", () => {
    expect(() =>
      buildGoldenSummaryInput({
        repositoryRoot: process.cwd(),
        receipt: {
          schemaVersion: 1,
          generatedAt: input.generatedAt,
          finalHead: "0".repeat(40),
          pins: input.pins,
          generatedDigest: input.generatedDigest,
          deviations: [],
          evidencePaths: input.evidencePaths,
          commands: input.commands,
        },
      }),
    ).toThrow(/head|stale|receipt/u);
  });

  it("has an executable caller that writes only the four required summaries", () => {
    const repositoryRoot = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "golden-summary-cli-"));
    const outputRoot = join(root, "artifacts/saas-ui-golden");
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
    const receiptPath = join(root, "receipt.json");
    writeFileSync(
      receiptPath,
      `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: input.generatedAt,
        finalHead,
        pins,
        generatedDigest,
        deviations: [],
        evidencePaths: input.evidencePaths,
        commands: input.commands,
      })}\n`,
    );

    writeGoldenSummariesCli([
      "--receipt",
      receiptPath,
      "--output-root",
      outputRoot,
    ]);

    expect(readdirSync(outputRoot).sort()).toEqual([
      "acceptance-summary.json",
      "accessibility-summary.json",
      "deviation-summary.json",
      "interaction-summary.json",
    ]);
  });
});
