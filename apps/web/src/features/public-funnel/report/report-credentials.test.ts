import { describe, expect, it, vi } from "vitest";

import {
  consumeFakeReportVerification,
  createAnonymousReportCredentials,
  requestFakeReportVerification,
} from "./report-credentials";

describe("public report credentials", () => {
  it("creates opaque session and access tokens separately", () => {
    const values = ["session-nonce", "access-nonce"];
    const credentials = createAnonymousReportCredentials(
      () => values.shift() ?? "missing",
    );
    expect(credentials).toEqual({
      sessionId: "session_session-nonce",
      accessToken: "access_access-nonce",
    });
    expect(credentials.sessionId).not.toContain(credentials.accessToken);
  });

  it("consumes a browser-fake verification token once without storing email", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    try {
      const url = requestFakeReportVerification(
        "report_1",
        "founder@example.test",
        () => "token",
      );
      expect(JSON.stringify([...values])).not.toContain("founder@example.test");
      expect(url).toContain("verify_token");
      expect(
        consumeFakeReportVerification("verify_token", () => "owner"),
      ).toMatchObject({
        reportId: "report_1",
        ownerAccessToken: "owner_owner",
      });
      expect(consumeFakeReportVerification("verify_token")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
