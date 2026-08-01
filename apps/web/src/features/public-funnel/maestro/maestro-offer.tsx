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
          <p role="status">
            The closest Maestro blueprint is planned, not executable today.
          </p>
        ) : null}
        {recommendMaestro ? (
          <section className="idea-maestro-credit">
            <h2>Your purchase carries forward</h2>
            <p>
              You have {formatUsd(creditCents)} Maestro credit from this Build
              Pack purchase.
            </p>
            <a
              className="idea-primary-action"
              href={`/maestro/start/${packId}`}
            >
              Start building with Maestro
            </a>
          </section>
        ) : null}
        <a href={`/build-pack/${packId}`}>Return to your Build Pack</a>
      </main>
    </PublicFunnelShell>
  );
}
