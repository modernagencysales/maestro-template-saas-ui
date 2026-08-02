import { useEffect, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";

import { useTemplateQuery } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { loadBuildPack } from "../build-pack/build-pack-storage";
import { maestroCreditFor } from "../checkout/commerce-storage";
import { loadEvaluation } from "../evaluation-storage";
import { PublicFunnelShell } from "../public-shell";
import { loadOwnerAccessToken } from "../report/report-credentials";
import { MaestroOffer } from "./maestro-offer";

export function MaestroOfferRoute({ packId }: { readonly packId: string }) {
  return isConvexConfigured() ? (
    <ConfiguredMaestroOfferRoute packId={packId} />
  ) : (
    <LocalMaestroOfferRoute packId={packId} />
  );
}

function ConfiguredMaestroOfferRoute({ packId }: { readonly packId: string }) {
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const offer = useTemplateQuery(
    templateConfectRefs.public.buildPacks.maestro.getOffer,
    packId && ownerAccessToken ? { packId, ownerAccessToken } : "skip",
  );

  if (offer.status === "ready") {
    return (
      <ConfiguredMaestroOfferView
        packId={packId}
        state={{
          _tag: "ready",
          blueprintStatus: offer.data.blueprintStatus,
          creditCents: offer.data.creditCents,
          fit: offer.data.fit,
        }}
      />
    );
  }
  if (offer.status === "loading") {
    return (
      <ConfiguredMaestroOfferView packId={packId} state={{ _tag: "loading" }} />
    );
  }
  return (
    <ConfiguredMaestroOfferView
      packId={packId}
      state={{ _tag: "unavailable" }}
    />
  );
}

export type ConfiguredMaestroOfferState =
  | { readonly _tag: "loading" }
  | { readonly _tag: "unavailable" }
  | {
      readonly _tag: "ready";
      readonly creditCents: number;
      readonly fit: "strong" | "partial" | "low";
      readonly blueprintStatus: "implemented" | "planned";
    };

export function ConfiguredMaestroOfferView({
  packId,
  state,
}: {
  readonly packId: string;
  readonly state: ConfiguredMaestroOfferState;
}) {
  if (state._tag === "ready") {
    return (
      <MaestroOffer
        blueprintStatus={state.blueprintStatus}
        creditCents={state.creditCents}
        fit={state.fit}
        packId={packId}
      />
    );
  }
  if (state._tag === "loading") {
    return <MaestroOfferStatus title="Preparing your honest Maestro fit…" />;
  }
  return (
    <MaestroOfferStatus
      title="Maestro handoff is unavailable"
      message="Open this link from the browser where you verified and purchased the Build Pack, or contact support."
    />
  );
}

function MaestroOfferStatus({
  title,
  message,
}: {
  readonly title: string;
  readonly message?: string;
}) {
  return (
    <PublicFunnelShell>
      <main className="idea-information" id="main-content" aria-live="polite">
        <h1>{title}</h1>
        {message ? <p>{message}</p> : null}
        {message ? <a href="/support">Contact support</a> : null}
      </main>
    </PublicFunnelShell>
  );
}

function LocalMaestroOfferRoute({ packId }: { readonly packId: string }) {
  const [offer, setOffer] = useState<{
    readonly creditCents: number;
    readonly fit: "strong" | "partial" | "low";
  }>({ creditCents: 0, fit: "low" });

  useEffect(() => {
    const stored = loadBuildPack(packId);
    const reportId = stored?.run.reportId ?? "";
    const evaluation = loadEvaluation(reportId);
    const score = evaluation?.result.dimensions.maestroFit.score ?? 0;
    setOffer({
      creditCents: maestroCreditFor(reportId),
      fit: score >= 60 ? "strong" : score >= 35 ? "partial" : "low",
    });
  }, [packId]);

  return (
    <MaestroOffer
      blueprintStatus="implemented"
      creditCents={offer.creditCents}
      fit={offer.fit}
      packId={packId}
    />
  );
}
