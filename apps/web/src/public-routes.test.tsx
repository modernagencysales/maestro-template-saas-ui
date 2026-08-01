import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrivacyRoute } from "./routes/privacy";
import { SupportRoute } from "./routes/support";
import { TermsRoute } from "./routes/terms";

describe("public route boundaries", () => {
  it("render the public legal and support pages", () => {
    for (const route of [<PrivacyRoute />, <SupportRoute />, <TermsRoute />]) {
      expect(renderToStaticMarkup(route)).toContain("main");
    }
  });
});
