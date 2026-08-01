import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckoutView } from "./checkout-view";

describe("Complete Build Pack checkout", () => {
  it("shows the exact deliverable and Maestro credit", () => {
    const html = renderToStaticMarkup(
      <CheckoutView
        priceCents={2900}
        reportId="idea_1"
        state={{ _tag: "ready" }}
      />,
    );

    expect(html).toContain("Complete Build Pack");
    expect(html).toContain("$29.00 Maestro credit");
    expect(html).toContain("Continue to secure checkout");
  });

  it("describes a return as payment-pending, not paid", () => {
    const html = renderToStaticMarkup(
      <CheckoutView
        priceCents={2900}
        reportId="idea_1"
        state={{ _tag: "payment-pending" }}
      />,
    );

    expect(html).toContain("Confirming your payment");
    expect(html).not.toContain("Build Pack unlocked");
  });
});
