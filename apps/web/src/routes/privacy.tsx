import { createFileRoute } from "@tanstack/react-router";

import { PublicInformationPage } from "../features/public-funnel/legal-page";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
});

export function PrivacyRoute() {
  return (
    <PublicInformationPage title="Privacy">
      <p>
        Your idea and answers are used to produce your evaluation. They are not
        sold and are never included in analytics event payloads.
      </p>
      <p>
        We use Admaxxer and our configured advertising destinations to measure
        page views, campaign parameters such as UTMs and <code>fbclid</code>,
        and conversion attribution. A sanitized visitor identifier may be
        carried in checkout metadata. A Lead is sent only after a report is
        durably saved or claimed; a Purchase is sent only after a verified Dodo
        payment webhook. Idea, answer, report, prompt, and payment contents are
        excluded from those events. Where required, non-essential tracking waits
        for consent and available opt-out controls remain applicable.
      </p>
      <h2>AI processing</h2>
      <p>
        Free evaluations use a bounded AI model. Paid Build Packs may use
        stronger models and cited public research. Provider payloads are not
        exposed in public errors.
      </p>
      <h2>Control your work</h2>
      <p>
        You can delete a saved evaluation or revoke a public sharing link from
        your report library.
      </p>
    </PublicInformationPage>
  );
}
