import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildPackGeneratingRoute } from "./build-pack/build-pack-generating-route";
import { BuildPackReadyRoute } from "./build-pack/build-pack-ready-route";
import { CheckoutReturnRoute } from "./checkout/checkout-return-route";
import { BuildPackCheckoutRoute } from "./checkout/checkout-route";
import { FakeHostedCheckoutRoute } from "./checkout/fake-hosted-checkout-route";
import { AppIdeaIntake } from "./intake/intake-view";
import { MaestroOfferRoute } from "./maestro/maestro-offer-route";
import { PublicReportShareRoute } from "./report/public-report-share-route";
import { ReportLibraryRoute } from "./report/report-library-route";
import { EvaluationReportRoute } from "./report/report-route";

describe("public funnel route shells", () => {
  it("renders every client-state route safely before hydration", () => {
    const routes = [
      <BuildPackGeneratingRoute key="generating" reportId="idea_1" />,
      <BuildPackReadyRoute key="ready" packId="pack_1" />,
      <CheckoutReturnRoute key="return" />,
      <BuildPackCheckoutRoute key="checkout" reportId="idea_1" />,
      <FakeHostedCheckoutRoute key="hosted" sessionId="checkout_1" />,
      <AppIdeaIntake key="intake" />,
      <MaestroOfferRoute key="maestro" packId="pack_1" />,
      <PublicReportShareRoute key="share" token="share_1" />,
      <ReportLibraryRoute key="library" />,
      <EvaluationReportRoute id="idea_1" key="report" />,
    ];

    for (const route of routes) {
      expect(renderToStaticMarkup(route)).toContain("main");
    }
  });
});
