import { describe, expect, it } from "vitest";

import {
  assertCanonicalBranch,
  assertDemoPageText,
  parseDemoArgs,
} from "./demo-brain-lib.mts";

describe("Maestro Brain demo guard", () => {
  it("requires the canonical product branch", () => {
    expect(() =>
      assertCanonicalBranch("product/maestro-brain", "product/maestro-brain"),
    ).not.toThrow();
    expect(() =>
      assertCanonicalBranch(
        "codex/maestro-brain-implementation-plan",
        "product/maestro-brain",
      ),
    ).toThrow(/canonical branch product\/maestro-brain/);
  });

  it("accepts only the product-specific screen identity", () => {
    expect(() =>
      assertDemoPageText(
        ["Clients", "Agency Brain", "Connections", "Settings"].join("\n"),
        {
          requiredText: ["Clients", "Agency Brain", "Connections", "Settings"],
          forbiddenText: ["Pro surfaces", "Showcase", "Kanban"],
        },
      ),
    ).not.toThrow();

    expect(() =>
      assertDemoPageText("Dashboard\nShowcase\nKanban", {
        requiredText: ["Clients", "Agency Brain"],
        forbiddenText: ["Showcase", "Kanban"],
      }),
    ).toThrow(/forbidden marker Showcase/);
  });

  it("keeps a single explicit local endpoint", () => {
    expect(parseDemoArgs([])).toEqual({
      host: "127.0.0.1",
      port: 5199,
      openBrowser: true,
      verifyOnly: false,
    });
    expect(
      parseDemoArgs(["--no-open", "--verify-only", "--port", "5201"]),
    ).toEqual({
      host: "127.0.0.1",
      port: 5201,
      openBrowser: false,
      verifyOnly: true,
    });
    expect(() => parseDemoArgs(["--port", "not-a-port"])).toThrow(
      /valid TCP port/,
    );
  });
});
