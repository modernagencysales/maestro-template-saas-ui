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

  it("maps component enqueue failures to the public validation error", async () => {
    const failure = await Effect.runPromiseExit(
      enqueueBuildPackRunWith(
        async () => Promise.reject(new Error("private component failure")),
        "pack_123",
      ),
    );

    expect(failure._tag).toBe("Failure");
    expect(String(failure)).toContain("The Build Pack could not be queued.");
    expect(String(failure)).not.toContain("private component failure");
  });
});
