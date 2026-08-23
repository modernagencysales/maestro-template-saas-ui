import { describe, expect, it } from "vitest";
import {
  beginConnection,
  completeConnection,
  revokeConnection,
  type ProviderConnectionState,
} from "./connectionLifecycle";

const activeConnection = (): ProviderConnectionState => ({
  provider: "slack",
  status: "active",
  generation: 2,
  connectionRef: "conn_redacted_2",
});

describe("provider connection lifecycle", () => {
  it("advances the generation and clears prior provider metadata on begin", () => {
    expect(beginConnection(activeConnection())).toEqual({
      provider: "slack",
      status: "authorizing",
      generation: 3,
    });
  });

  it("makes the same completion idempotent", () => {
    const authorizing = beginConnection(activeConnection());
    const completed = completeConnection(authorizing, {
      generation: 3,
      status: "active",
      connectionRef: "conn_redacted_3",
    });

    expect(
      completeConnection(completed, {
        generation: 3,
        status: "active",
        connectionRef: "conn_redacted_3",
      }),
    ).toEqual(completed);
  });

  it("rejects stale completion and revocation attempts", () => {
    expect(() =>
      completeConnection(activeConnection(), {
        generation: 1,
        status: "error",
        errorCode: "provider_unavailable",
      }),
    ).toThrow("stale provider connection generation");
    expect(() => revokeConnection(activeConnection(), 1)).toThrow(
      "stale provider connection generation",
    );
  });

  it("makes same-generation revocation idempotent", () => {
    const revoked = revokeConnection(activeConnection(), 2);
    expect(revokeConnection(revoked, 2)).toEqual(revoked);
  });

  it("rejects completion after revocation", () => {
    const revoked = revokeConnection(activeConnection(), 2);
    expect(() =>
      completeConnection(revoked, {
        generation: 2,
        status: "active",
        connectionRef: "conn_redacted_2",
      }),
    ).toThrow("provider connection transition is not allowed");
  });
});
