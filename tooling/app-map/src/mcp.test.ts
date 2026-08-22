import { beforeEach, describe, expect, it, vi } from "vitest";

const surface = vi.hoisted(() => ({
  map: vi.fn(),
  impact: vi.fn(),
}));

vi.mock("./surface", () => ({
  executeAppMapMap: surface.map,
  executeAppMapImpact: surface.impact,
}));

import { createAppMapMcpProjection } from "./mcp";

describe("App Map MCP projection", () => {
  beforeEach(() => {
    surface.map.mockReset();
    surface.impact.mockReset();
  });

  it("advertises the three closed read-only tools", () => {
    const projection = createAppMapMcpProjection("/repo");
    expect(projection.tools().map(({ name }) => name)).toEqual([
      "maestro_app_map",
      "maestro_app_map_impact",
      "maestro_build_readiness",
    ]);
    expect(
      projection
        .tools()
        .every(({ inputSchema }) => inputSchema.additionalProperties === false),
    ).toBe(true);
  });

  it("fails closed on unknown, extra, mistyped, or ambiguous arguments", async () => {
    const projection = createAppMapMcpProjection("/repo");
    await expect(projection.call("unknown", {})).resolves.toMatchObject({
      isError: true,
      code: "MCP_UNKNOWN_TOOL",
    });
    await expect(
      projection.call("maestro_app_map", { baseRevision: "a" }),
    ).resolves.toMatchObject({ isError: true, code: "MCP_INVALID_ARGUMENT" });
    await expect(
      projection.call("maestro_app_map", { revision: 1 }),
    ).resolves.toMatchObject({ isError: true, code: "MCP_INVALID_ARGUMENT" });
    await expect(
      projection.call("maestro_app_map_impact", {}),
    ).resolves.toMatchObject({ isError: true, code: "MCP_INVALID_ARGUMENT" });
    await expect(
      projection.call("maestro_app_map_impact", {
        baseRevision: "a",
        trustedCiBaseRevision: "b",
      }),
    ).resolves.toMatchObject({ isError: true, code: "MCP_INVALID_ARGUMENT" });
    expect(surface.map).not.toHaveBeenCalled();
    expect(surface.impact).not.toHaveBeenCalled();
  });

  it("projects Build Readiness with the four canonical groups", async () => {
    const groups = ["Screens", "Data", "Automations", "Connections"].map(
      (name) => ({ name, items: [] }),
    );
    surface.map.mockResolvedValue({
      ok: true,
      human: "Build Readiness",
      data: {
        readiness: { schemaVersion: 1, title: "Build Readiness", groups },
      },
    });
    const result = await createAppMapMcpProjection("/repo").call(
      "maestro_build_readiness",
      {},
    );
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ groups });
  });
});
