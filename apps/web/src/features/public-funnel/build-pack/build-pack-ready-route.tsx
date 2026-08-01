import { useEffect, useState } from "react";

import {
  BuildPackRouteView,
  type BuildPackRouteState,
} from "./build-pack-route";
import { loadBuildPack } from "./build-pack-storage";

export function BuildPackReadyRoute({ packId }: { readonly packId: string }) {
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
