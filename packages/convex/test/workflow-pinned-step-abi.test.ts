import { describe, expect, it } from "vitest";

import type { RunDurableGraphStep } from "../confect/workflows/_kit/graphRunnerCurrent";

type ActionOptions = NonNullable<
  Parameters<RunDurableGraphStep["runAction"]>[2]
>;
type QueryOptions = NonNullable<Parameters<RunDurableGraphStep["runQuery"]>[2]>;

const actionRunAt = {
  name: "provider.v1",
  retry: false,
  runAt: 1_000,
} satisfies ActionOptions;
const actionRunAfter = {
  name: "provider.v1",
  retry: false,
  runAfter: 250,
} satisfies ActionOptions;
const queryRunAt = {
  name: "lookup.v1",
  runAt: 1_000,
} satisfies QueryOptions;
const queryRunAfter = {
  name: "lookup.v1",
  runAfter: 250,
} satisfies QueryOptions;

// @ts-expect-error The pinned scheduler ABI permits exactly one schedule field.
const invalidBoth = { runAt: 1_000, runAfter: 250 } satisfies ActionOptions;

describe("pinned Workflow 0.4.4 step scheduling ABI", () => {
  it("retains exact action runAt and runAfter shapes", () => {
    expect(actionRunAt).toEqual({
      name: "provider.v1",
      retry: false,
      runAt: 1_000,
    });
    expect(actionRunAfter).toEqual({
      name: "provider.v1",
      retry: false,
      runAfter: 250,
    });
  });

  it("retains exact query runAt and runAfter shapes", () => {
    expect(queryRunAt).toEqual({ name: "lookup.v1", runAt: 1_000 });
    expect(queryRunAfter).toEqual({ name: "lookup.v1", runAfter: 250 });
  });

  it("keeps the negative type fixture in the compile surface", () => {
    expect(invalidBoth).toEqual({ runAt: 1_000, runAfter: 250 });
  });
});
