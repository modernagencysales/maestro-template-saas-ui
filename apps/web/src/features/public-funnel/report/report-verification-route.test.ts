import { describe, expect, it, vi } from "vitest";

import { consumeReportVerificationToken } from "./report-verification-route";

describe("consumeReportVerificationToken", () => {
  it("consumes an explicit fake verification locally exactly once", async () => {
    const consumeFake = vi
      .fn()
      .mockReturnValueOnce({
        reportId: "report_1",
        ownerAccessToken: "owner_1",
      })
      .mockReturnValueOnce(null);
    const consumeLive = vi.fn();

    await expect(
      consumeReportVerificationToken({
        verificationToken: "verify_1",
        mode: "fake",
        convexConfigured: true,
        consumeFake,
        consumeLive,
      }),
    ).resolves.toEqual({
      reportId: "report_1",
      ownerAccessToken: "owner_1",
    });
    await expect(
      consumeReportVerificationToken({
        verificationToken: "verify_1",
        mode: "fake",
        convexConfigured: true,
        consumeFake,
        consumeLive,
      }),
    ).resolves.toBeNull();
    expect(consumeFake).toHaveBeenCalledTimes(2);
    expect(consumeLive).not.toHaveBeenCalled();
  });

  it("consumes locally when Convex is not configured", async () => {
    const consumeFake = vi.fn().mockReturnValue({
      reportId: "report_2",
      ownerAccessToken: "owner_2",
    });
    const consumeLive = vi.fn();

    await expect(
      consumeReportVerificationToken({
        verificationToken: "verify_2",
        mode: null,
        convexConfigured: false,
        consumeFake,
        consumeLive,
      }),
    ).resolves.toMatchObject({ reportId: "report_2" });
    expect(consumeLive).not.toHaveBeenCalled();
  });

  it("uses the live consumer only for configured non-fake links", async () => {
    const consumeFake = vi.fn();
    const consumeLive = vi.fn().mockResolvedValue({
      reportId: "report_live",
      ownerAccessToken: "owner_live",
    });

    await expect(
      consumeReportVerificationToken({
        verificationToken: "verify_live",
        mode: null,
        convexConfigured: true,
        consumeFake,
        consumeLive,
      }),
    ).resolves.toMatchObject({ reportId: "report_live" });
    expect(consumeFake).not.toHaveBeenCalled();
    expect(consumeLive).toHaveBeenCalledWith("verify_live");
  });
});
