import { describe, expect, it } from "vitest";

import {
  APP_MAP_GROUPS,
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

  it("exposes a narrow V1 template-instance fact adapter", async () => {
    const adapter: TemplateInstanceFactsAdapterV1 = {
      adapterVersion: 1,
      sourceId: "template-instance",
      load: async ({ repoRoot }) => ({
        adapterVersion: 1,
        source: {
          id: "template-instance",
          kind: "template-instance",
          path: "template-instance.json",
          version: "1",
          digest: `sha256:${repoRoot.length.toString().padStart(64, "0")}`,
        },
        nodes: [],
        edges: [],
      }),
    };

    const batch = await adapter.load({ repoRoot: "/customer" });
    expect(batch.source.id).toBe("template-instance");
    expect(adapter.sourceId).toBe("template-instance");
  });
});
