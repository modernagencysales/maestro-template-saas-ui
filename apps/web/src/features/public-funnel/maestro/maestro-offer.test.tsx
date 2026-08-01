import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MaestroOffer } from "./maestro-offer";

describe("Maestro template handoff", () => {
  it("shows equal credit and portable handoff for a strong fit", () => {
    const html = renderToStaticMarkup(
      <MaestroOffer
        packId="pack_1"
        creditCents={2900}
        fit="strong"
        blueprintStatus="implemented"
      />,
    );
    expect(html).toContain("$29.00 Maestro credit");
    expect(html).toContain("Start building with Maestro");
    expect(html).toContain("agency or coding agent");
  });

  it("does not push the template when the fit is low", () => {
    const html = renderToStaticMarkup(
      <MaestroOffer
        packId="pack_1"
        creditCents={2900}
        fit="low"
        blueprintStatus="planned"
      />,
    );
    expect(html).toContain("Use your Build Pack anywhere");
    expect(html).not.toContain("Start building with Maestro");
    expect(html).toContain("planned, not executable");
  });
});
