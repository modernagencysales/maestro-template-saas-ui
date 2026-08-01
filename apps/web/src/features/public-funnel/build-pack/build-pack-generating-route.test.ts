import { describe, expect, it } from "vitest";

import { presentServerPackStatus } from "./build-pack-generating-route";

const stages = [
  { name: "normalize" as const, status: "completed" as const, attempts: 1 },
  { name: "challenge" as const, status: "running" as const, attempts: 1 },
];

describe("configured Build Pack generation presentation", () => {
  it("keeps completed checkpoint progress visible", () => {
    expect(
      presentServerPackStatus({
        packId: "pack_1",
        status: "running",
        stages,
      }),
    ).toEqual({ _tag: "generating", stages });
  });

  it("offers retry only for a recoverable checkpoint", () => {
    expect(
      presentServerPackStatus({
        packId: "pack_1",
        status: "failed-recoverable",
        stages,
      }),
    ).toEqual({
      _tag: "failed",
      canRetry: true,
      supportId: "support_pack_1",
    });
    expect(
      presentServerPackStatus({
        packId: "pack_1",
        status: "needs-support",
        stages,
      }),
    ).toEqual({
      _tag: "failed",
      canRetry: false,
      supportId: "support_pack_1",
    });
  });

  it("never presents revoked access as generation", () => {
    expect(
      presentServerPackStatus({
        packId: "pack_1",
        status: "revoked",
        stages,
      }),
    ).toEqual({ _tag: "revoked" });
  });
});
