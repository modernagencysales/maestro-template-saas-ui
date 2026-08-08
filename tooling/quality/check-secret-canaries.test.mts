import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-secret-canaries.mts";

describe("check:secret-canaries", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("detects a known fake secret canary with gitleaks", () => {
    expect(
      execFileSync("gitleaks", ["version"], { encoding: "utf8" }).trim(),
    ).toBe("8.30.1");
    const dir = mkdtempSync(join(tmpdir(), "maestro-template-gitleaks-"));
    const canary = join(dir, "canary.env");

    const envName = "SERVICE" + "_API_KEY";
    const fakeValue = "abcdefghijklmnopqrstuvwxyz" + "123456";

    writeFileSync(canary, `${envName}="${fakeValue}"\n`);

    let failed = false;
    try {
      execFileSync("gitleaks", [
        "detect",
        "--config",
        fileURLToPath(new URL("../../.gitleaks.toml", import.meta.url)),
        "--no-git",
        "--redact",
        "--source",
        dir,
      ]);
    } catch {
      failed = true;
    }

    if (!failed) {
      throw new Error("gitleaks did not detect the fake secret canary");
    }
  });

  it("excludes packed Git metadata from the no-git working-tree scan", () => {
    const dir = mkdtempSync(join(tmpdir(), "maestro-template-gitleaks-git-"));
    const packDir = join(dir, ".git", "objects", "pack");
    mkdirSync(packDir, { recursive: true });
    const envName = "SERVICE" + "_API_KEY";
    const fakeValue = "abcdefghijklmnopqrstuvwxyz" + "123456";
    writeFileSync(join(packDir, "fixture.pack"), `${envName}="${fakeValue}"\n`);
    writeFileSync(join(dir, "source.ts"), "export const clean = true;\n");

    expect(() =>
      execFileSync("gitleaks", [
        "detect",
        "--config",
        fileURLToPath(new URL("../../.gitleaks.toml", import.meta.url)),
        "--no-git",
        "--redact",
        "--source",
        dir,
      ]),
    ).not.toThrow();
  });
});
