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

  it("labels the verified checkout email and explains why it is needed", () => {
    const html = renderToStaticMarkup(
      <CheckoutView
        email="founder@example.test"
        onEmailChange={() => undefined}
        priceCents={2900}
        reportId="idea_1"
        state={{ _tag: "ready" }}
      />,
    );

    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain("Email used to save this report");
    expect(html).toContain("This must match the email you verified");
  });
});
