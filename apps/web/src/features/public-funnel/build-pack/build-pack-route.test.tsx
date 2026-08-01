import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildPackRouteView } from "./build-pack-route";

describe("Build Pack route states", () => {
  it("does not generate without an active entitlement", () => {
    const html = renderToStaticMarkup(
      <BuildPackRouteView packId="pack_1" state={{ _tag: "revoked" }} />,
    );
    expect(html).toContain("Build Pack access is not active");
    expect(html).not.toContain("Turning your idea into");
  });

  it("offers a recovery path when generation cannot resume automatically", () => {
    const html = renderToStaticMarkup(
      <BuildPackRouteView
        packId="pack_1"
        state={{ _tag: "failed", supportId: "support_123", canRetry: true }}
      />,
    );
    expect(html).toContain("Retry generation");
    expect(html).toContain("support_123");
    expect(html).toContain("without buying again");
  });
});
