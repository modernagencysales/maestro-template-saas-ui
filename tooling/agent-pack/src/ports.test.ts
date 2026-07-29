import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import {
  inspectStartPorts,
  nodeStartPortProbe,
  startPortPlan,
} from "./ports.js";

describe("start ports", () => {
  it("selects deterministic mode-specific ports and the real readiness URL", () => {
    expect(startPortPlan("fake")).toEqual({
      web: 5173,
      readinessPresenter: 4174,
      required: [
        { id: "web", port: 5173 },
        { id: "readiness-presenter", port: 4174 },
      ],
      url: "http://127.0.0.1:5173",
      readinessUrl: "http://127.0.0.1:5173/health",
      buildReadinessUrl: "http://127.0.0.1:4174/",
    });
    expect(startPortPlan("local").required).toEqual([
      { id: "web", port: 5173 },
      { id: "convex", port: 3210 },
      { id: "convex-site", port: 3211 },
      { id: "readiness-presenter", port: 4174 },
    ]);
    expect(startPortPlan("dev").required).toEqual([
      { id: "web", port: 5173 },
      { id: "readiness-presenter", port: 4174 },
    ]);
  });

  it("reports every collision before process startup", async () => {
    const result = await inspectStartPorts(startPortPlan("local"), {
      available: async (port) => port === 3211,
    });

    expect(result).toEqual({
      ok: false,
      collisions: [
        { id: "web", port: 5173 },
        { id: "convex", port: 3210 },
        { id: "readiness-presenter", port: 4174 },
      ],
    });
  });

  it("treats a wildcard listener as a collision for loopback start", async () => {
    const listener = createServer();
    await new Promise<void>((resolve, reject) => {
      listener.once("error", reject);
      listener.listen({ port: 0, host: "0.0.0.0" }, resolve);
    });

    try {
      const address = listener.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected a TCP listener address.");
      }
      await expect(
        nodeStartPortProbe.available(address.port, "127.0.0.1"),
      ).resolves.toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        listener.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
