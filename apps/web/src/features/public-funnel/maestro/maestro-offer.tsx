import { PublicFunnelShell } from "../public-shell";

const formatUsd = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export function MaestroOffer({
  packId,
  creditCents,
  fit,
  blueprintStatus,
}: {
  readonly packId: string;
  readonly creditCents: number;
  readonly fit: "strong" | "partial" | "low";
  readonly blueprintStatus: "implemented" | "planned";
}) {
  const recommendMaestro = fit !== "low" && blueprintStatus === "implemented";
  return (
    <PublicFunnelShell>
      <main className="idea-maestro-offer" id="main-content">
        <section className="idea-maestro-summary">
          <p className="idea-section-label">Your next step</p>
          <h1>
            {recommendMaestro
              ? "Build from a proven SaaS foundation."
              : "Use your Build Pack anywhere."}
          </h1>
          <p>
            Your Complete Build Pack is portable. Give it to a developer, agency
            or coding agent and they will know what to build.
          </p>
          {blueprintStatus === "planned" ? (
            <p className="idea-maestro-notice" role="status">
              The closest Maestro blueprint is planned, not executable today.
            </p>
          ) : null}
        </section>
        {recommendMaestro ? (
          <section className="idea-maestro-credit">
            <div>
              <p className="idea-section-label">Included credit</p>
              <h2>Your purchase carries forward.</h2>
              <p>
                You have {formatUsd(creditCents)} Maestro credit from this Build
                Pack purchase.
              </p>
            </div>
            <div className="idea-maestro-actions">
              <a
                className="idea-primary-action"
                href={`/maestro/start/${packId}`}
              >
                Start building with Maestro
              </a>
              <a
                className="idea-secondary-action"
                href={`/build-pack/${packId}`}
              >
                Return to your Build Pack
              </a>
            </div>
          </section>
        ) : (
          <div className="idea-maestro-actions">
            <a className="idea-secondary-action" href={`/build-pack/${packId}`}>
              Return to your Build Pack
            </a>
          </div>
        )}
      </main>
    </PublicFunnelShell>
  );
}
