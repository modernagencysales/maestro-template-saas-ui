import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as TestClock from "effect/testing/TestClock";

import {
  currentDate,
  currentIso,
  currentTimeMillis,
} from "../confect/shared/clock";
import {
  createDeterministicNonce,
  createWebCryptoNonce,
} from "../confect/shared/nonce";

describe("shared clock and nonce seams", () => {
  it("uses the Effect test clock for deterministic time", async () => {
    await Effect.gen(function* () {
      yield* TestClock.setTime(1782864000000);

      const now = yield* currentTimeMillis;
      const date = yield* currentDate;
      const iso = yield* currentIso;

      expect(now).toBe(1782864000000);
      expect(date).toEqual(new Date("2026-07-01T00:00:00.000Z"));
      expect(iso).toBe("2026-07-01T00:00:00.000Z");
    }).pipe(Effect.provide(TestClock.layer()), Effect.runPromise);
  });

  it("supports injected nonce sequences", () => {
    const nonce = createDeterministicNonce(["first", "second"]);

    expect(nonce.next()).toBe("first");
    expect(nonce.next()).toBe("second");
    expect(() => nonce.next()).toThrow(/No deterministic nonce values remain/);
  });

  it("creates Web Crypto nonce values with base64url shape", () => {
    const nonce = createWebCryptoNonce({
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) {
          array.fill(7);
        }

        return array;
      },
    });

    expect(nonce.next()).toBe("BwcHBwcHBwcHBwcHBwcH");
  });
});
