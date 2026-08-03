import { describe, expect, it } from "vitest";
import { retryTransientPrerenderStartup } from "./finalFilesystem.test-support.js";

describe("final filesystem prerender startup retry", () => {
  it("retries bounded loopback startup refusals until the build succeeds", async () => {
    let attempts = 0;
    const waits: number[] = [];
    const result = await retryTransientPrerenderStartup(
      async () => {
        attempts += 1;
        if (attempts < 3)
          throw new Error("connect ECONNREFUSED 127.0.0.1:41731");
        return "built";
      },
      4,
      async (delayMs) => {
        waits.push(delayMs);
      },
    );

    expect(result).toBe("built");
    expect(attempts).toBe(3);
    expect(waits).toEqual([1_000, 1_000]);
  });

  it("does not retry unrelated build failures", async () => {
    let attempts = 0;
    await expect(
      retryTransientPrerenderStartup(async () => {
        attempts += 1;
        throw new Error("TypeScript compilation failed");
      }),
    ).rejects.toThrow("TypeScript compilation failed");

    expect(attempts).toBe(1);
  });

  it("fails after the bounded startup attempt budget", async () => {
    let attempts = 0;
    await expect(
      retryTransientPrerenderStartup(async () => {
        attempts += 1;
        throw new Error("connect ECONNREFUSED 127.0.0.1:41731");
      }, 3),
    ).rejects.toThrow("ECONNREFUSED");

    expect(attempts).toBe(3);
  });
});
