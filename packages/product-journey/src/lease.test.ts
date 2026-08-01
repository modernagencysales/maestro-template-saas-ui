import { describe, expect, it } from "vitest";
import { effectiveAdmissionState } from "./lease";

describe("effectiveAdmissionState", () => {
  it("marks a lease stale when a transitive dependency is stale", () => {
    expect(
      effectiveAdmissionState({
        sourceState: "admitted",
        lease: { health: "current", expiresAt: "2026-08-02T00:00:00.000Z" },
        dependencies: [
          {
            health: "current",
            dependencies: [{ health: "stale", dependencies: [] }],
          },
        ],
        now: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ).toEqual({
      sourceState: "admitted",
      leaseHealth: "stale",
      effectiveState: "stale",
    });
  });

  it("marks an expired admitted lease stale", () => {
    expect(
      effectiveAdmissionState({
        sourceState: "admitted",
        lease: { health: "current", expiresAt: "2026-07-31T00:00:00.000Z" },
        dependencies: [],
        now: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ).toEqual({
      sourceState: "admitted",
      leaseHealth: "stale",
      effectiveState: "stale",
    });
  });
});
