import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import { enqueueBuildPackRunWith } from "./workpool";

describe("Build Pack workpool adapter", () => {
  it("enqueues the requested pack through the component adapter", async () => {
    const enqueued: string[] = [];

    await Effect.runPromise(
      enqueueBuildPackRunWith(async (packId) => {
        enqueued.push(packId);
      }, "pack_123"),
    );

    expect(enqueued).toEqual(["pack_123"]);
  });
});
