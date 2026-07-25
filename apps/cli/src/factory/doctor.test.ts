import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCliAsync } from "../index";
import { DOCTOR_HELP } from "./doctor";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("provider doctor CLI", () => {
  it("routes a versioned read-only Convex fake doctor", async () => {
    const result = await runCliAsync(
      ["doctor", "convex", "--environment", "fake", "--json"],
      undefined,
      repoRoot,
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      command: { id: "doctor", version: 1 },
      mutationPosture: "read-only",
      exitClass: "success",
      data: {
        provider: "convex",
        environment: "fake",
        ready: true,
        safeStoppingPoint: true,
        mcp: { enabled: false, optInProfile: "none" },
      },
    });
    expect(result.stderr).toBe("");
  });

  it("reports names only and rejects production", async () => {
    const dev = await runCliAsync(
      ["doctor", "convex", "--environment", "dev", "--json"],
      undefined,
      repoRoot,
    );
    const production = await runCliAsync(
      ["doctor", "convex", "--environment", "production", "--json"],
      undefined,
      repoRoot,
    );

    expect(JSON.parse(dev.stdout)).toMatchObject({
      exitClass: "findings",
      data: { missingEnvironmentNames: expect.any(Array) },
    });
    expect(JSON.parse(production.stdout)).toMatchObject({
      exitClass: "invalidInvocation",
    });
    expect(dev.stdout).not.toMatch(/=https?:|deploy-key-value|secret-value/i);
  });

  it("routes exact provider doctor help", async () => {
    await expect(
      runCliAsync(["doctor", "--help"], undefined, repoRoot),
    ).resolves.toMatchObject({ exitCode: 0, stdout: DOCTOR_HELP, stderr: "" });
  });
});
