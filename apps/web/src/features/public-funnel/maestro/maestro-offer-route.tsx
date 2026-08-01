import { useEffect, useState } from "react";

import { loadEvaluation } from "../evaluation-storage";
import { maestroCreditFor } from "../checkout/commerce-storage";
import { loadBuildPack } from "../build-pack/build-pack-storage";
import { MaestroOffer } from "./maestro-offer";

export function MaestroOfferRoute({ packId }: { readonly packId: string }) {
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
