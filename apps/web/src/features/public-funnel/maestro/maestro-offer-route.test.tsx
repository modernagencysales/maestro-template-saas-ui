import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConfiguredMaestroOfferView } from "./maestro-offer-route";

describe("configured Maestro handoff", () => {
  it("renders the persisted server credit and blueprint decision", () => {
    const html = renderToStaticMarkup(
      <ConfiguredMaestroOfferView
        packId="pack_1"
        state={{
          _tag: "ready",
          creditCents: 2900,
          fit: "strong",
          blueprintStatus: "implemented",
        }}
      />,
    );

    expect(html).toContain("$29.00 Maestro credit");
    expect(html).toContain("Start building with Maestro");
  });

  it("fails closed with a support path", () => {
    const html = renderToStaticMarkup(
      <ConfiguredMaestroOfferView
        packId="pack_1"
        state={{ _tag: "unavailable" }}
      />,
    );

    expect(html).toContain("Maestro handoff is unavailable");
    expect(html).toContain("Contact support");
    expect(html).not.toContain("Start building with Maestro");
  });
});
