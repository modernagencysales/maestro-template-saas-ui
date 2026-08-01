import { describe, expect, it } from "vitest";
import type { ProductJourneyManifest } from "./manifest";
import { selectAffectedJourneys } from "./selection";

const catalog = [
  {
    id: "source",
    affectedPaths: ["packages/source/**"],
    dependsOnJourneys: [],
  },
  {
    id: "consumer",
    affectedPaths: ["apps/web/**"],
    dependsOnJourneys: [
      { id: "source", minimumVersion: 1, terminalReceiptKind: "source.v1" },
    ],
  },
] as unknown as readonly ProductJourneyManifest[];

describe("selectAffectedJourneys", () => {
  it("fails safe for an unknown release surface and invalidates dependents transitively", () => {
    const inventory = {
      releaseEntrypoints: [],
      receiptProducers: [],
      receiptConsumers: [],
      frontiers: [],
      legacyEntrypoints: [],
      today: "2026-08-01",
      classifiedPaths: ["packages/source/**", "apps/web/**"],
    };
    expect(
      selectAffectedJourneys(catalog, inventory, ["unknown/release.ts"]),
    ).toEqual(catalog.map(({ id }) => id));
    expect(
      selectAffectedJourneys(catalog, inventory, [
        "packages/source/handler.ts",
      ]),
    ).toEqual(["consumer", "source"]);
  });

  it("returns selected journeys in code-point order", () => {
    const inventory = {
      releaseEntrypoints: [],
      receiptProducers: [],
      receiptConsumers: [],
      frontiers: [],
      legacyEntrypoints: [],
      today: "2026-08-01",
      classifiedPaths: ["**"],
    };
    const reversed = [...catalog].reverse();
    expect(
      selectAffectedJourneys(reversed, inventory, ["packages/source/file.ts"]),
    ).toEqual(["consumer", "source"]);
  });
});
