import { describe, expect, it } from "vitest";
import { describeRouteAnnouncement } from "./route-announcements";

describe("route announcements", () => {
  it("names V1 product shell routes for screen-reader navigation updates", () => {
    expect(describeRouteAnnouncement("/clients")).toBe("Viewing Clients");
    expect(describeRouteAnnouncement("/brain")).toBe("Viewing Agency Brain");
    expect(describeRouteAnnouncement("/connections")).toBe(
      "Viewing Connections",
    );
    expect(describeRouteAnnouncement("/settings")).toBe("Viewing Settings");
  });

  it("falls back to an unknown-route announcement for hidden reference paths", () => {
    expect(describeRouteAnnouncement("/workflows")).toBe(
      "Viewing Unknown route",
    );
    expect(describeRouteAnnouncement("/missing")).toBe("Viewing Unknown route");
  });
});
