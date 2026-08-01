import type {
  BuildPackStage,
  CompleteBuildPack,
} from "@maestro-template/app-idea-evaluator";

import { PublicFunnelShell } from "../public-shell";
import { BuildPackProgress, CompleteBuildPackView } from "./build-pack-view";

export type BuildPackRouteState =
  | { readonly _tag: "generating"; readonly stages: readonly BuildPackStage[] }
  | { readonly _tag: "ready"; readonly pack: CompleteBuildPack }
  | {
      readonly _tag: "failed";
      readonly canRetry: boolean;
      readonly supportId: string;
    }
  | { readonly _tag: "revoked" };

export function BuildPackRouteView({
  packId,
  state,
  onRetry,
}: {
  readonly packId: string;
  readonly state: BuildPackRouteState;
  readonly onRetry?: () => void;
}) {
  if (state._tag === "generating") {
    return <BuildPackProgress packId={packId} stages={state.stages} />;
  }
  if (state._tag === "ready") {
    return <CompleteBuildPackView pack={state.pack} packId={packId} />;
  }
  if (state._tag === "revoked") {
    return (
      <PublicFunnelShell>
        <main className="idea-information" id="main-content">
          <h1>Build Pack access is not active</h1>
          <p>Contact support if you believe this purchase is still eligible.</p>
          <a href="/support">Contact support</a>
        </main>
      </PublicFunnelShell>
    );
  }
  return (
    <PublicFunnelShell>
      <main className="idea-information" id="main-content">
        <h1>Generation paused safely</h1>
        <p>
          Completed sections are saved. You can resume without buying again.
        </p>
        <p>Support ID: {state.supportId}</p>
        {state.canRetry ? (
          <button onClick={onRetry} type="button">
            Retry generation
          </button>
        ) : (
          <a href="/support">Contact support</a>
        )}
      </main>
    </PublicFunnelShell>
  );
}
