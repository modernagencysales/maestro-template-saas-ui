import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runGeneratorCli } from "./index.js";

const reviewedInput = (): unknown =>
  JSON.parse(
    readFileSync(
      new URL("../../release/__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;

describe("template:upgrade reviewed-engine wiring", () => {
  it("routes a reviewed input through the collision-free planner", () => {
    const cwd = mkdtempSync(join(tmpdir(), "template-upgrade-wiring-"));

    try {
      writeFileSync(
        join(cwd, "reviewed-upgrade-input.json"),
        JSON.stringify(reviewedInput()),
      );

      const result = runGeneratorCli(
        [
          "upgrade",
          "--from",
          "0.1.0-alpha.1",
          "--to",
          "0.2.0-alpha.1",
          "--path",
          "reviewed-upgrade-input.json",
        ],
        cwd,
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        schemaVersion: 1,
        mode: "plan-only",
        writeAvailable: false,
        transitionId: "template-0.1-to-0.2",
        diff: expect.arrayContaining([
          expect.objectContaining({ classification: "modify-template" }),
          expect.objectContaining({ classification: "move-template" }),
        ]),
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("fails closed when CLI versions do not match the reviewed transition", () => {
    const cwd = mkdtempSync(join(tmpdir(), "template-upgrade-mismatch-"));

    try {
      writeFileSync(
        join(cwd, "reviewed-upgrade-input.json"),
        JSON.stringify(reviewedInput()),
      );

      const result = runGeneratorCli(
        [
          "upgrade",
          "--from",
          "0.1.0-alpha.1",
          "--to",
          "0.3.0-alpha.1",
          "--path",
          "reviewed-upgrade-input.json",
        ],
        cwd,
      );

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        schemaVersion: 1,
        mode: "plan-only",
        writeAvailable: false,
        resolutions: [
          expect.objectContaining({ code: "UPGRADE_INPUT_INVALID" }),
        ],
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
