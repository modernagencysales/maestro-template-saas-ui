import { beforeEach, describe, expect, it, vi } from "vitest";

const surface = vi.hoisted(() => ({
  map: vi.fn(),
  impact: vi.fn(),
}));

vi.mock("@maestro-template/app-map-tooling/surface", () => ({
  executeAppMapMap: surface.map,
  executeAppMapImpact: surface.impact,
}));

import { createAppMapCliHandlers } from "./appMap";

const handler = (command: "map" | "impact") => {
  const value = createAppMapCliHandlers().find(
    (item) => item.command === command,
  );
  if (!value) throw new Error(`Missing ${command} handler.`);
  return value;
};

describe("App Map CLI", () => {
  beforeEach(() => {
    surface.map.mockReset();
    surface.impact.mockReset();
  });

  it("renders human output by default and full data only with --json", async () => {
    surface.map.mockResolvedValue({
      ok: true,
      human: "Screens (1)\n",
      data: { map: { schemaVersion: 1 } },
    });
    await expect(handler("map").run(["map"], "/repo")).resolves.toEqual({
      exitCode: 0,
      stdout: "Screens (1)\n",
      stderr: "",
    });
    await expect(
      handler("map").run(["map", "--json"], "/repo"),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: '{\n  "map": {\n    "schemaVersion": 1\n  }\n}\n',
    });
  });

  it("rejects missing or ambiguous impact bases before composition", async () => {
    await expect(
      handler("impact").run(["impact"], "/repo"),
    ).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("--base SHA | --trusted-ci-base SHA"),
    });
    await expect(
      handler("impact").run(
        ["impact", "--base", "a", "--trusted-ci-base", "b"],
        "/repo",
      ),
    ).resolves.toMatchObject({ exitCode: 1 });
    expect(surface.impact).not.toHaveBeenCalled();
  });

  it("passes a trusted exact CI base without substituting a local default", async () => {
    const base = "a".repeat(40);
    const head = "b".repeat(40);
    surface.impact.mockResolvedValue({
      ok: true,
      human: "Impact\n",
      data: { complete: true },
    });
    await expect(
      handler("impact").run(
        ["impact", "--trusted-ci-base", base, "--head", head],
        "/repo",
      ),
    ).resolves.toMatchObject({ exitCode: 0, stdout: "Impact\n" });
    expect(surface.impact).toHaveBeenCalledWith({
      repoRoot: "/repo",
      trustedCiBaseRevision: base,
      headRevision: head,
    });
  });
});
