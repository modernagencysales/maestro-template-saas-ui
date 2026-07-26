import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createUpgradeCliHandler,
  readMigrationVerificationInput,
} from "./upgrade";

const roots: string[] = [];
const temp = (): string => {
  const root = mkdtempSync(join(tmpdir(), "maestro-upgrade-cli-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("upgrade migration lifecycle", () => {
  it("requires Git-bound release authority for migration planning", async () => {
    const root = temp();
    const result = await createUpgradeCliHandler().run(
      ["upgrade", "migration-plan"],
      root,
    );
    expect(result).toMatchObject({
      exitCode: 1,
      stdout: "",
      stderr: expect.stringMatching(/--release-root and --to/),
    });
  });

  it("reads only bounded relative regular files without symbolic links", () => {
    const root = temp();
    const outside = temp();
    writeFileSync(join(root, "verification.json"), '{"receipt":null}');
    expect(
      readMigrationVerificationInput(root, [
        "upgrade",
        "migration-verify",
        "--input",
        "verification.json",
      ]),
    ).toEqual({ receipt: null });
    symlinkSync(join(root, "verification.json"), join(root, "linked.json"));
    writeFileSync(join(outside, "outside.json"), "{}");
    writeFileSync(join(root, "large.json"), "x".repeat(1024 * 1024 + 1));
    for (const input of [
      "linked.json",
      "../outside.json",
      join(outside, "outside.json"),
      "large.json",
      "missing.json",
    ])
      expect(() =>
        readMigrationVerificationInput(root, [
          "upgrade",
          "migration-verify",
          "--input",
          input,
        ]),
      ).toThrow("Migration verification input could not be read.");
  });

  it("does not disclose JSON parse details", () => {
    const root = temp();
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "invalid.json"), "{");
    expect(() =>
      readMigrationVerificationInput(root, [
        "upgrade",
        "migration-verify",
        "--input",
        "invalid.json",
      ]),
    ).toThrow("Migration verification input could not be read.");
  });
});
