import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppIdeaLanding } from "./landing";

describe("app idea landing", () => {
  it("renders the approved promise and primary action", () => {
    const html = renderToStaticMarkup(<AppIdeaLanding />);

    expect(html).toContain("Tell me if your app idea is good.");
    expect(html).toContain("Know what it will take to build it.");
    expect(html).toContain("Roast my app idea");
    expect(html).toContain('href="/evaluate"');
    expect(html).not.toContain("Revenue workspace");
  });

  it("sets honest expectations for the free report", () => {
    const html = renderToStaticMarkup(<AppIdeaLanding />);

    expect(html).toContain("free Buildability Report");
    expect(html).toContain("No account required");
    expect(html).toContain("Complete Build Pack");
  });
});
