import { describe, expect, it, vi } from "vitest";

import {
  consumeFakeReportVerification,
  createAnonymousReportCredentials,
  loadAnonymousReportAccess,
  loadOwnerAccessToken,
  requestFakeReportVerification,
  saveAnonymousReportAccess,
  saveOwnerAccessToken,
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

  it("round-trips anonymous and owner access through browser storage", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    try {
      const credentials = {
        sessionId: "session_1",
        accessToken: "access_1",
      };
      saveAnonymousReportAccess("report_1", credentials);
      saveOwnerAccessToken("owner_1");

      expect(loadAnonymousReportAccess("report_1")).toEqual(credentials);
      expect(loadOwnerAccessToken()).toBe("owner_1");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects malformed stored access and invalid verification email", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "not-json",
        setItem: () => undefined,
      },
    });
    try {
      expect(loadAnonymousReportAccess("report_1")).toBeNull();
      expect(() =>
        requestFakeReportVerification("report_1", "not-an-email"),
      ).toThrow("A valid email is required.");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses opaque browser nonces when callers do not supply a test nonce", () => {
    const values = new Map<string, string>();
    let nonce = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `uuid-${String(++nonce)}`,
    });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    try {
      expect(createAnonymousReportCredentials()).toEqual({
        sessionId: "session_uuid-1",
        accessToken: "access_uuid-2",
      });
      const url = requestFakeReportVerification(
        "report_1",
        "founder@example.test",
      );
      expect(url).toContain("verify_uuid-3");
      expect(consumeFakeReportVerification("verify_uuid-3")).toEqual({
        reportId: "report_1",
        ownerAccessToken: "owner_uuid-4",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
