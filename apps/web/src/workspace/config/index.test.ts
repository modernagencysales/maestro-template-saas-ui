import { describe, expect, it } from "vitest";

import { segments } from "./index";

describe("starter feature configuration", () => {
  it("exposes the pinned starter admin segment for settings and billing", () => {
    expect(segments).toEqual({
      segments: [
        {
          id: "admin",
          attr: [{ key: "roles", value: "admin" }],
          features: ["settings", "billing"],
        },
      ],
    });
  });
});
