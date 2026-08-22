import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APP_MAP_GROUPS,
  APP_MAP_INPUT_MANIFEST_V1,
  groupForNodeKind,
  type TemplateInstanceFactsAdapterV1,
} from "./schema";

describe("App Map schema", () => {
  it("keeps the four human groups in their canonical order", () => {
    expect(APP_MAP_GROUPS).toEqual([
      "Screens",
      "Data",
      "Automations",
      "Connections",
    ]);
    expect(groupForNodeKind("route")).toBe("Screens");
    expect(groupForNodeKind("table")).toBe("Data");
    expect(groupForNodeKind("workflow-version")).toBe("Automations");
    expect(groupForNodeKind("provider")).toBe("Connections");
  });

  it("closes the V1 input inventory over unique adapter and source authorities", () => {
    expect(APP_MAP_INPUT_MANIFEST_V1).toMatchObject({
      id: "maestro-app-map-input",
      version: 1,
      provenanceContract: "exact-batch-source-v1",
    });
    expect(APP_MAP_INPUT_MANIFEST_V1.requiredSources).toHaveLength(11);
    expect(
      new Set(
        APP_MAP_INPUT_MANIFEST_V1.requiredSources.map(
          (entry) => entry.adapter.id,
        ),
      ).size,
    ).toBe(APP_MAP_INPUT_MANIFEST_V1.requiredSources.length);
    expect(
      new Set(
        APP_MAP_INPUT_MANIFEST_V1.requiredSources.map(
          (entry) => entry.source.id,
        ),
      ).size,
    ).toBe(APP_MAP_INPUT_MANIFEST_V1.requiredSources.length);

    expect(
      APP_MAP_INPUT_MANIFEST_V1.requiredSources.find(
        (entry) => entry.source.id === "template-instance",
      ),
    ).toMatchObject({
      adapter: { id: "template-instance-facts", version: 1 },
      source: {
        path: "template-instance.json",
        subject: "repository",
        owner: "template-instance-schema",
        digestContract: "sha256-file-bytes-v1",
      },
      allowedFacts: {
        nodeKinds: [],
        edgeKinds: [],
        ownershipTargets: [],
      },
    });
  });

  it("types the exact deferred template-instance adapter seam", () => {
    expectTypeOf<
      TemplateInstanceFactsAdapterV1["adapterId"]
    >().toEqualTypeOf<"template-instance-facts">();
    expectTypeOf<
      TemplateInstanceFactsAdapterV1["adapterVersion"]
    >().toEqualTypeOf<1>();
    expectTypeOf<
      TemplateInstanceFactsAdapterV1["sourceId"]
    >().toEqualTypeOf<"template-instance">();
  });
});
