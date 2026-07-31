import { createFileRoute } from "@tanstack/react-router";

import { PublicInformationPage } from "../features/public-funnel/legal-page";

export const Route = createFileRoute("/support")({ component: SupportRoute });

function SupportRoute() {
  return (
    <PublicInformationPage title="Support">
      <p>
        Need help with a report, payment, or Build Pack? Email support and
        include the support ID shown on the affected screen. Do not email your
        payment details.
      </p>
      <p>
        <a href="mailto:support@maestro.example">Email support</a>
      </p>
    </PublicInformationPage>
  );
}
