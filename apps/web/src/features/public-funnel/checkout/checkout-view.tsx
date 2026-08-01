import { ArrowRight, Check, Clock3, LockKeyhole } from "lucide-react";

import { PublicFunnelShell } from "../public-shell";

export type CheckoutViewState =
  | { readonly _tag: "ready" }
  | { readonly _tag: "redirecting" }
  | { readonly _tag: "payment-pending" }
  | { readonly _tag: "error"; readonly message: string };

export function CheckoutView({
  reportId,
  priceCents,
  state,
  onCheckout,
}: {
  readonly reportId: string;
  readonly priceCents: number;
  readonly state: CheckoutViewState;
  readonly onCheckout?: () => void;
}) {
  const price = `$${(priceCents / 100).toFixed(2)}`;
  if (state._tag === "payment-pending") {
    return (
      <PublicFunnelShell>
        <main
          className="idea-checkout-status"
          id="main-content"
          aria-live="polite"
        >
          <Clock3 aria-hidden="true" size={30} />
          <h1>Confirming your payment</h1>
          <p>
            The secure checkout has returned. Access appears as soon as the
            verified payment confirmation arrives.
          </p>
          <a href={`/checkout/${reportId}`}>Check payment status</a>
        </main>
      </PublicFunnelShell>
    );
  }
  return (
    <PublicFunnelShell>
      <main className="idea-checkout" id="main-content">
        <section>
          <p className="idea-section-label">Complete Build Pack</p>
          <h1>Turn the idea into a build-ready plan.</h1>
          <p>
            Get the specification, architecture, delivery phases, risks, and
            acceptance criteria a developer, agency, or coding agent needs.
          </p>
          <ul>
            {[
              "Product brief and prioritized scope",
              "User journeys and requirements",
              "Data model and technical architecture",
              "Delivery plan, risks, and acceptance criteria",
              "Maestro mapping and portable handoff prompt",
            ].map((item) => (
              <li key={item}>
                <Check aria-hidden="true" size={17} />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <aside>
          <p>One-time purchase</p>
          <strong>{price}</strong>
          <p>
            Includes a <b>{price} Maestro credit</b> if you choose to build with
            the template later.
          </p>
          {state._tag === "error" ? (
            <p className="idea-field-error" role="alert">
              {state.message}
            </p>
          ) : null}
          <button
            className="idea-primary-action"
            disabled={state._tag === "redirecting"}
            onClick={onCheckout}
            type="button"
          >
            {state._tag === "redirecting"
              ? "Opening secure checkout…"
              : "Continue to secure checkout"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
          <span>
            <LockKeyhole aria-hidden="true" size={14} />
            Secure payment by Dodo Payments
          </span>
        </aside>
      </main>
    </PublicFunnelShell>
  );
}
