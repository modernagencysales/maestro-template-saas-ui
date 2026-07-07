import { describe, expect, it } from "vitest";
import { describeRouteAnnouncement } from "./route-announcements";

describe("route announcements", () => {
  it("names template routes for screen-reader navigation updates", () => {
    expect(describeRouteAnnouncement("/")).toBe("Viewing Overview");
    expect(describeRouteAnnouncement("/", "#brain")).toBe("Viewing Brain");
    expect(describeRouteAnnouncement("/", "#headless")).toBe(
      "Viewing API and MCP",
    );
    expect(describeRouteAnnouncement("/onboarding")).toBe("Viewing Onboarding");
    expect(describeRouteAnnouncement("/legal")).toBe("Viewing Legal");
    expect(describeRouteAnnouncement("/billing")).toBe("Viewing Billing");
    expect(describeRouteAnnouncement("/health")).toBe("Viewing Health");
    expect(describeRouteAnnouncement("/data-lifecycle")).toBe(
      "Viewing Data Lifecycle",
    );
  });

  it("falls back to an unknown-route announcement for unregistered paths", () => {
    expect(describeRouteAnnouncement("/missing")).toBe("Viewing Unknown route");
  });
});
