import { describe, expect, it, vi } from "vitest";

const { discoverRegistryItems } = vi.hoisted(() => ({
  discoverRegistryItems: vi.fn(),
}));

vi.mock("@saas-ui/registry/compiler", () => ({ discoverRegistryItems }));

const { discoverInstallableItems } =
  await import("./materialize-pro-registry.mts");

describe("Saas UI Pro registry discovery", () => {
  it("collapses exact duplicate discoveries by name and source config", async () => {
    discoverRegistryItems.mockResolvedValue({
      items: [
        {
          type: "registry:hook",
          name: "duplicate",
          sourceDirectory: "/pro/packages/blocks/hooks",
        },
        {
          type: "registry:hook",
          name: "duplicate",
          sourceDirectory: "/pro/packages/blocks/hooks",
        },
      ],
    });

    await expect(discoverInstallableItems("/pro")).resolves.toEqual([
      {
        name: "duplicate",
        sourceConfig: "/pro/packages/blocks/hooks/duplicate.ts",
      },
    ]);
  });

  it("rejects duplicate block and hook ids before returning installed roots", async () => {
    discoverRegistryItems.mockResolvedValue({
      items: [
        {
          type: "registry:block",
          name: "duplicate",
          configPath: "/pro/packages/blocks/duplicate/component.config.ts",
          sourceDirectory: "/pro/packages/blocks/duplicate",
        },
        {
          type: "registry:hook",
          name: "duplicate",
          sourceDirectory: "/pro/packages/blocks/hooks",
        },
      ],
    });

    await expect(discoverInstallableItems("/pro")).rejects.toThrow(
      "duplicate registry root: duplicate",
    );
  });
});
