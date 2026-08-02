import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FakeHostedCheckoutView } from "./fake-hosted-checkout";

describe("fake hosted Dodo checkout", () => {
  it("keeps provider confirmation separate from the return page", () => {
    const html = renderToStaticMarkup(
      <FakeHostedCheckoutView
        amountCents={2900}
        reportId="idea_1"
        sessionId="checkout_1"
      />,
    );
    expect(html).toContain("Secure test checkout");
    expect(html).toContain("Pay $29.00");
    expect(html).toContain("Test mode");
    expect(html).not.toContain("Build Pack unlocked");
  });
});
