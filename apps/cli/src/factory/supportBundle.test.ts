import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCliAsync } from "../index";
import { SUPPORT_BUNDLE_HELP } from "./supportBundle";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("support bundle CLI", () => {
  it("previews the exact allowlisted local artifact by default", async () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-support-cli-"));
    roots.push(root);
    const result = await runCliAsync(
      ["support-bundle", "--json"],
      undefined,
      root,
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: { id: "support-bundle", version: 1 },
      mutationPosture: "preview",
      exitClass: "success",
      data: {
        output: ".maestro/support/support-bundle.json",
        write: false,
        exportedBytes: null,
        bundle: {
          handling: { automaticUpload: false, containsSecrets: false },
        },
      },
    });
    expect(existsSync(join(root, ".maestro"))).toBe(false);
  });

  it("exports with --write alone and remains CLI-only", async () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-support-cli-"));
    roots.push(root);
    const exported = await runCliAsync(
      ["support-bundle", "--write", "--json"],
      undefined,
      root,
    );

    expect(exported.exitCode).toBe(0);
    expect(JSON.parse(exported.stdout)).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: { write: true, exportedBytes: expect.any(Number) },
    });
    const bundle = readFileSync(
      join(root, ".maestro/support/support-bundle.json"),
      "utf8",
    );
    expect(JSON.parse(bundle)).toMatchObject({
      schemaVersion: 1,
      handling: { automaticUpload: false },
    });

    const obsolete = await runCliAsync(
      ["support-bundle", "--write", "--preview-fingerprint", "old"],
      undefined,
      root,
    );
    expect(obsolete.exitCode).toBe(2);
  });

  it("routes exact help", async () => {
    await expect(
      runCliAsync(["support-bundle", "--help"]),
    ).resolves.toMatchObject({ stdout: SUPPORT_BUNDLE_HELP });
  });
});
