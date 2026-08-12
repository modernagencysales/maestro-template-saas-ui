import { describe, expect, it } from "vitest";

import {
  checkSaasUiFoundation,
  readSaasUiAcceptance,
  readSaasUiDeviations,
  readSaasUiManifest,
  readSaasUiRegistryFiles,
} from "./saas-ui-foundation.js";

const root = process.cwd();

describe("Saas UI foundation authorities", () => {
  it("pins every paid source and maps every accepted composition", () => {
    const manifest = readSaasUiManifest(root);

    expect(manifest.pins).toEqual({
      template: "acf0bc4be38dea842f321831387fc77cf7242439",
      starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
      pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
    });
    expect(new Set(manifest.compositions.map(({ id }) => id))).toEqual(
      new Set([
        "app-shell",
        "dashboard-report",
        "data-grid",
        "filterable-collection",
        "list-detail",
        "split-inbox",
        "record-aside",
        "settings",
        "form",
        "onboarding",
        "kanban",
        "auth",
        "billing",
        "search-command",
        "states",
      ]),
    );
    expect(readSaasUiDeviations(root)).toEqual([]);
    expect(readSaasUiRegistryFiles(root).files.length).toBeGreaterThan(0);
    expect(checkSaasUiFoundation(root)).toEqual([]);
  });

  it("requires every composition to have acceptance evidence", () => {
    const manifest = readSaasUiManifest(root);
    const acceptance = readSaasUiAcceptance(root);

    expect(acceptance.entries).toHaveLength(manifest.compositions.length);
    expect(new Set(acceptance.entries.map(({ id }) => id))).toEqual(
      new Set(manifest.compositions.map(({ id }) => id)),
    );
    expect(
      acceptance.entries.every(
        ({ route, behaviorCheck, evidence }) =>
          route.startsWith("/") &&
          behaviorCheck.length > 0 &&
          evidence.length > 0,
      ),
    ).toBe(true);
  });
});
