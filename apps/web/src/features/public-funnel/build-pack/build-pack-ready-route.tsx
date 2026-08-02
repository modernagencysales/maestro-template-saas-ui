import { useEffect, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import {
  decodeCompleteBuildPack,
  type CompleteBuildPack,
} from "@maestro-template/app-idea-evaluator";

import { useTemplateQuery } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { loadOwnerAccessToken } from "../report/report-credentials";
import {
  BuildPackRouteView,
  type BuildPackRouteState,
} from "./build-pack-route";
import { loadBuildPack } from "./build-pack-storage";

export function BuildPackReadyRoute({ packId }: { readonly packId: string }) {
  return isConvexConfigured() ? (
    <ConfiguredBuildPackReadyRoute packId={packId} />
  ) : (
    <LocalBuildPackReadyRoute packId={packId} />
  );
}

export const parseCanonicalBuildPack = (
  canonicalPackJson: string,
): CompleteBuildPack => decodeCompleteBuildPack(JSON.parse(canonicalPackJson));

function ConfiguredBuildPackReadyRoute({
  packId,
}: {
  readonly packId: string;
}) {
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const pack = useTemplateQuery(
    templateConfectRefs.public.buildPacks.packs.getPack,
    ownerAccessToken ? { packId, ownerAccessToken } : "skip",
  );

  if (!ownerAccessToken) {
    return <BuildPackRouteView packId={packId} state={{ _tag: "revoked" }} />;
  }
  if (pack.status === "ready") {
    try {
      return (
        <BuildPackRouteView
          packId={packId}
          state={{
            _tag: "ready",
            pack: parseCanonicalBuildPack(pack.data.canonicalPackJson),
          }}
        />
      );
    } catch {
      return (
        <BuildPackRouteView
          packId={packId}
          state={{
            _tag: "failed",
            canRetry: false,
            supportId: `support_${packId}`,
          }}
        />
      );
    }
  }
  if (
    pack.status === "typed_failure" ||
    pack.status === "parse_failure" ||
    pack.status === "transport_failure" ||
    pack.status === "defect"
  ) {
    return <BuildPackRouteView packId={packId} state={{ _tag: "revoked" }} />;
  }
  return (
    <BuildPackRouteView
      packId={packId}
      state={{ _tag: "generating", stages: [] }}
    />
  );
}

function LocalBuildPackReadyRoute({ packId }: { readonly packId: string }) {
  const [state, setState] = useState<BuildPackRouteState>({ _tag: "revoked" });

  useEffect(() => {
    const stored = loadBuildPack(packId);
    if (stored?.pack && stored.run.status === "completed") {
      setState({ _tag: "ready", pack: stored.pack });
      return;
    }
    if (stored?.run.status === "failed-recoverable") {
      setState({
        _tag: "failed",
        canRetry: true,
        supportId: `support_${packId}`,
      });
      return;
    }
    setState({ _tag: "revoked" });
  }, [packId]);

  return <BuildPackRouteView packId={packId} state={state} />;
}
