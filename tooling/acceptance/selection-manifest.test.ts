import { describe, expect, it, vi } from "vitest";

import * as productContract from "../../packages/template-core/src/productContract";
import type { ContractInventory } from "./contract-inventory";
import { selectContracts } from "./selection-manifest";

const source = (
  uri: string,
  journeyId: `journey_${string}`,
  lifecycle: "assembling" | "admitted" | "suspended",
) => ({
  path: uri,
  uri,
  bytes: `Feature: ${journeyId}\n`,
  sha256: `sha256:${uri}` as `sha256:${string}`,
  journeyId,
  lifecycle,
  featureName: journeyId,
  description: "",
});

const pickle = (
  key: string,
  sourceUri: string,
  journeyId: `journey_${string}`,
  lifecycle: "assembling" | "admitted" | "suspended",
) => ({
  key: `pickle_sha256:${key}` as `pickle_sha256:${string}`,
  sourceSha256: `sha256:${sourceUri}` as `sha256:${string}`,
  uri: sourceUri,
  sourceUri,
  journeyId,
  lifecycle,
  name: key,
  scenarioLocation: { line: 1, column: 1 },
  tags: [],
  transports: ["ui"] as const,
  coverageTags: [],
  denialTags: [],
  crossSurface: false,
  steps: [
    {
      key: `step_sha256:${key}` as `step_sha256:${string}`,
      index: 0,
      pickleStepType: "Action" as const,
      type: "Action" as const,
      text: `execute ${key}`,
      astLocation: { line: 2, column: 5 },
    },
  ],
});

const inventory = (input: {
  readonly sources: readonly ReturnType<typeof source>[];
  readonly pickles: readonly ReturnType<typeof pickle>[];
}): ContractInventory => ({
  schemaVersion: 1,
  ...input,
  admittedPickleKeys: input.pickles
    .filter((value) => value.lifecycle === "admitted")
    .map((value) => value.key),
  journeys: Object.fromEntries(
    input.sources.map((value) => [value.journeyId, value.lifecycle]),
  ),
  authPolicyDeltas: [],
});

describe("selectContracts", () => {
  it("selects complete admitted Features and their exact Pickles without compiling", () => {
    const compile = vi.spyOn(productContract, "compileProductContractSource");
    const orders = source(
      "features/orders.feature",
      "journey_orders",
      "admitted",
    );
    const draft = source(
      "features/draft.feature",
      "journey_draft",
      "assembling",
    );
    const ordersFirst = pickle(
      "orders-first",
      orders.uri,
      orders.journeyId,
      orders.lifecycle,
    );
    const ordersSecond = pickle(
      "orders-second",
      orders.uri,
      orders.journeyId,
      orders.lifecycle,
    );
    const draftPickle = pickle(
      "draft",
      draft.uri,
      draft.journeyId,
      draft.lifecycle,
    );
    const complete = inventory({
      sources: [orders, draft],
      pickles: [ordersSecond, draftPickle, ordersFirst],
    });

    const selected = selectContracts({
      inventory: complete,
      mode: "authoritative",
    });

    expect(selected.sourcePaths).toEqual([orders.uri]);
    expect(selected.pickleKeys).toEqual([ordersFirst.key, ordersSecond.key]);
    expect(selected.sources).toEqual([orders]);
    expect(selected.pickles).toEqual([ordersFirst, ordersSecond]);
    expect(selected.sources[0]).toBe(orders);
    expect(selected.pickles[0]).toBe(ordersFirst);
    expect(selected.pickles[1]).toBe(ordersSecond);
    expect(selected.pickles[0]?.steps[0]?.key).toBe(ordersFirst.steps[0]?.key);
    expect(compile).not.toHaveBeenCalled();
  });

  it("selects one complete admitted journey, never a partial Feature", () => {
    const orders = source(
      "features/orders.feature",
      "journey_orders",
      "admitted",
    );
    const billing = source(
      "features/billing.feature",
      "journey_billing",
      "admitted",
    );
    const ordersFirst = pickle(
      "orders-first",
      orders.uri,
      orders.journeyId,
      orders.lifecycle,
    );
    const ordersSecond = pickle(
      "orders-second",
      orders.uri,
      orders.journeyId,
      orders.lifecycle,
    );
    const billingPickle = pickle(
      "billing",
      billing.uri,
      billing.journeyId,
      billing.lifecycle,
    );
    const complete = inventory({
      sources: [orders, billing],
      pickles: [ordersSecond, billingPickle, ordersFirst],
    });

    expect(
      selectContracts({
        inventory: complete,
        mode: "focused",
        journeyId: "journey_orders",
      }),
    ).toMatchObject({
      sourcePaths: [orders.uri],
      pickleKeys: [ordersFirst.key, ordersSecond.key],
    });
  });

  it.each([
    [
      "unknown focus",
      inventory({ sources: [], pickles: [] }),
      "journey_unknown",
    ],
    [
      "empty focus",
      inventory({
        sources: [
          source("features/empty.feature", "journey_empty", "admitted"),
        ],
        pickles: [],
      }),
      "journey_empty",
    ],
  ] as const)("rejects %s", (_name, complete, journeyId) => {
    expect(() =>
      selectContracts({ inventory: complete, mode: "focused", journeyId }),
    ).toThrow(/focus|journey|Pickle/u);
  });

  it.each([
    [
      "duplicate normalized path",
      [
        source("features/Orders.feature", "journey_orders", "admitted"),
        source("features/orders.feature", "journey_other", "admitted"),
      ],
    ],
    [
      "traversal",
      [source("features/../orders.feature", "journey_orders", "admitted")],
    ],
    [
      "rerun-file Feature basename",
      [source("features/@rerun.feature", "journey_orders", "admitted")],
    ],
  ] as const)("rejects %s inventory paths", (_name, sources) => {
    expect(() =>
      selectContracts({
        inventory: inventory({
          sources,
          pickles: sources.map((value, index) =>
            pickle(`${index}`, value.uri, value.journeyId, value.lifecycle),
          ),
        }),
        mode: "authoritative",
      }),
    ).toThrow(/path|rerun/u);
  });

  it("rejects Pickles not derived from a selected inventory source", () => {
    const orders = source(
      "features/orders.feature",
      "journey_orders",
      "admitted",
    );
    expect(() =>
      selectContracts({
        inventory: inventory({
          sources: [orders],
          pickles: [
            pickle(
              "forged",
              "features/forged.feature",
              orders.journeyId,
              orders.lifecycle,
            ),
          ],
        }),
        mode: "authoritative",
      }),
    ).toThrow(/derived|source/u);
  });
});
