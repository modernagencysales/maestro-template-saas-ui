import { PublicFunnelShell } from "../public-shell";

export function FakeHostedCheckoutView({
  amountCents,
  reportId,
  sessionId,
  onPay,
}: {
  readonly amountCents: number;
  readonly reportId: string;
  readonly sessionId: string;
  readonly onPay?: () => void;
}) {
  return (
    <PublicFunnelShell>
      <main className="idea-checkout" id="main-content">
        <p className="idea-section-label">Test mode</p>
        <h1>Secure test checkout</h1>
        <p>
          This local provider page simulates Dodo. Confirmation is delivered as
          a verified event before you return to the app.
        </p>
        <button className="idea-primary-action" onClick={onPay} type="button">
          Pay ${(amountCents / 100).toFixed(2)}
        </button>
        <p className="idea-pack-id">
          Session {sessionId} · Report {reportId}
        </p>
      </main>
    </PublicFunnelShell>
  );
}
