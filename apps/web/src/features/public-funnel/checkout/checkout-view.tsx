import { type FormEvent } from "react";
import { ArrowRight, Check, Clock3, LockKeyhole } from "lucide-react";

import { PublicFunnelShell } from "../public-shell";

export type CheckoutViewState =
  | { readonly _tag: "ready" }
  | { readonly _tag: "redirecting" }
  | { readonly _tag: "payment-pending" }
  | { readonly _tag: "payment-delayed" }
  | { readonly _tag: "error"; readonly message: string };

export function CheckoutView({
  reportId,
  priceCents,
  state,
  email,
  onEmailChange,
  onCheckout,
  onRefresh,
}: {
  readonly reportId: string;
  readonly priceCents: number;
  readonly state: CheckoutViewState;
  readonly email?: string;
  readonly onEmailChange?: (email: string) => void;
  readonly onCheckout?: () => void;
  readonly onRefresh?: () => void;
}) {
  const price = `$${(priceCents / 100).toFixed(2)}`;
  const submitCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCheckout?.();
  };
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
  if (state._tag === "payment-delayed") {
    return (
      <PublicFunnelShell>
        <main className="idea-checkout-status" id="main-content" role="status">
          <Clock3 aria-hidden="true" size={30} />
          <h1>Payment confirmation is taking longer than usual</h1>
          <p>
            Your Build Pack remains locked until the verified payment notice
            arrives. You will not be charged again by checking.
          </p>
          <div className="idea-inline-actions">
            <button
              className="idea-primary-action"
              onClick={onRefresh}
              type="button"
            >
              Check payment status again
            </button>
            <a href="/support">Contact support</a>
          </div>
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
        <form className="idea-checkout-card" onSubmit={submitCheckout}>
          <p>One-time purchase</p>
          <strong>{price}</strong>
          <p>
            Includes a <b>{price} Maestro credit</b> if you choose to build with
            the template later.
          </p>
          {onEmailChange ? (
            <div className="idea-checkout-email">
              <label htmlFor="checkout-email">
                Email used to save this report
              </label>
              <input
                aria-describedby="checkout-email-hint"
                autoComplete="email"
                id="checkout-email"
                name="email"
                onChange={(event) => onEmailChange(event.currentTarget.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email ?? ""}
              />
              <p id="checkout-email-hint">
                This must match the email you verified.
              </p>
            </div>
          ) : null}
          {state._tag === "error" ? (
            <p className="idea-field-error" role="alert">
              {state.message}
            </p>
          ) : null}
          <button
            className="idea-primary-action"
            disabled={state._tag === "redirecting"}
            type="submit"
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
        </form>
      </main>
    </PublicFunnelShell>
  );
}
