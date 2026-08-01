import { useEffect, useState } from "react";

import { loadEvaluation } from "../evaluation-storage";
import { entitlementStatusFor } from "../checkout/commerce-storage";
import {
  completeFakeBuildPack,
  saveBuildPack,
  startBuildPackGeneration,
  type StoredBuildPack,
} from "./build-pack-storage";
import { BuildPackRouteView } from "./build-pack-route";

export function BuildPackGeneratingRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  const [stored, setStored] = useState<StoredBuildPack | null>(null);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    const evaluation = loadEvaluation(reportId);
    const entitlementStatus = entitlementStatusFor(reportId);
    if (!evaluation || entitlementStatus !== "active") {
      setRevoked(true);
      return;
    }
    const started = startBuildPackGeneration({
      evaluation,
      entitlementStatus,
    });
    saveBuildPack(started);
    setStored(started);
    const timer = window.setTimeout(() => {
      const completed = completeFakeBuildPack(started, evaluation);
      saveBuildPack(completed);
      window.location.assign(`/build-pack/${completed.run.packId}`);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [reportId]);

  if (revoked) {
    return <BuildPackRouteView packId={reportId} state={{ _tag: "revoked" }} />;
  }
  return stored ? (
    <BuildPackRouteView
      packId={stored.run.packId}
      state={{ _tag: "generating", stages: stored.run.stages }}
    />
  ) : (
    <BuildPackRouteView
      packId={reportId}
      state={{ _tag: "generating", stages: [] }}
    />
  );
}
