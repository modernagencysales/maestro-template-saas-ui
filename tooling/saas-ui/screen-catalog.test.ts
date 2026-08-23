import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildScreenCatalog,
  verifyVendoredScreenCatalog,
  verifyShippedScreenCatalog,
} from "./screen-catalog.mts";

const root = resolve(import.meta.dirname, "../..");
const proRoot = join(root, "repos/saas-ui-pro");
const starterRoot = join(root, "repos/tanstack-start-starter-kit-pro");
const catalogPath = join(root, "docs/template/saas-ui-screen-catalog.json");
const receiptPath = join(root, "docs/template/saas-ui-vendor-receipt.json");
const sha256 = (source: string): string =>
  createHash("sha256").update(source).digest("hex");

describe("complete Saas UI screen catalogue", () => {
  it("indexes every full-demo route and every Pro story from pinned source", async () => {
    const catalog = await buildScreenCatalog({ proRoot, starterRoot });

    expect(catalog.pins).toEqual({
      starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
      pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
    });
    expect(catalog.repositories).toEqual({
      starter: "https://github.com/saas-js/tanstack-start-starter-kit-pro.git",
      pro: "https://github.com/saas-js/saas-ui-pro.git",
    });
    expect(catalog.demoRoutes).toHaveLength(24);
    expect(catalog.demoStates).toHaveLength(2);
    expect(catalog.stories).toHaveLength(56);
    expect(catalog.demoRoutes.map(({ route }) => route)).toEqual(
      expect.arrayContaining([
        "/[workspace]/companies",
        "/[workspace]/contacts",
        "/[workspace]/reports",
        "/[workspace]/updates",
        "/[workspace]/updates/[id]",
        "/[workspace]/workflows",
        "/[workspace]/settings/account/api",
        "/[workspace]/settings/account/notifications",
        "/getting-started",
        "/login",
      ]),
    );
    expect(catalog.stories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "packages/blocks/templates/writer/writer.stories.tsx",
        }),
        expect.objectContaining({
          source:
            "packages/blocks/sidebar-layouts/sidebar1/sidebar1.stories.tsx",
        }),
        expect.objectContaining({
          source:
            "packages/react/src/components/data-grid/data-grid.stories.tsx",
        }),
        expect.objectContaining({
          source: "packages/kanban/src/kanban.stories.tsx",
        }),
      ]),
    );
  });

  it("records byte-level provenance and matches the committed catalogue", async () => {
    const catalog = await buildScreenCatalog({ proRoot, starterRoot });
    const committed = JSON.parse(await readFile(catalogPath, "utf8"));

    expect(committed).toEqual(catalog);
    expect(await verifyVendoredScreenCatalog(root)).toEqual([]);
    expect(await verifyShippedScreenCatalog(root)).toEqual([]);

    for (const entry of [...catalog.demoRoutes, ...catalog.stories]) {
      const content = await readFile(join(proRoot, entry.source), "utf8");
      expect(entry.sha256).toBe(sha256(content));
      expect(entry.closure).toContainEqual({
        source: entry.source,
        sha256: entry.sha256,
      });
      expect(entry.closureSha256).toMatch(/^[a-f0-9]{64}$/u);
    }

    const settings = catalog.demoRoutes.find(
      ({ route }) => route === "/[workspace]/settings",
    );
    expect(settings?.composition).toBe(
      "apps/demo/src/features/settings/pages/overview",
    );
    expect(settings?.closure.map(({ source }) => source)).toContain(
      "apps/demo/src/features/settings/pages/overview.tsx",
    );

    const contacts = catalog.starterRoutes.find(
      ({ route }) => route === "/$workspace/contacts",
    );
    expect(contacts?.composition).toBe(
      "apps/web/src/features/contacts/list/list-page",
    );
    expect(contacts?.closure.map(({ source }) => source)).toContain(
      "apps/web/src/features/contacts/list/list-page.tsx",
    );

    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    expect(receipt.sources).toEqual([
      expect.objectContaining({ id: "saas-ui-pro", files: 831 }),
      expect.objectContaining({
        id: "tanstack-start-starter-kit-pro",
        files: 435,
      }),
    ]);
    expect(receipt.entries).toHaveLength(831 + 435);
  });

  it("indexes the complete TanStack Starter route and story source", async () => {
    const catalog = await buildScreenCatalog({ proRoot, starterRoot });

    expect(catalog.starterRoutes.length).toBeGreaterThanOrEqual(25);
    expect(catalog.starterStories.length).toBeGreaterThanOrEqual(16);
    expect(catalog.starterRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: "/$workspace/contacts" }),
        expect.objectContaining({ route: "/$workspace/inbox/$id" }),
        expect.objectContaining({ route: "/$workspace/settings/billing" }),
      ]),
    );
  });
});
