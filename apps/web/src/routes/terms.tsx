import { createFileRoute } from "@tanstack/react-router";

import { PublicInformationPage } from "../features/public-funnel/legal-page";

export const Route = createFileRoute("/terms")({ component: TermsRoute });

function TermsRoute() {
  return (
    <PublicInformationPage title="Terms">
      <p>
        The evaluation is decision support, not a promise of commercial success.
        You remain responsible for validation, legal review, and build
        decisions.
      </p>
      <h2>Free report</h2>
      <p>
        The free verdict is complete and unblurred. It may be revised when you
        change your answers.
      </p>
      <h2>Paid Build Packs</h2>
      <p>
        A paid Build Pack is generated after payment is confirmed. Recoverable
        generation failures can resume without another purchase.
      </p>
    </PublicInformationPage>
  );
}
