import { useEffect, useRef, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import type { BuildPackStage } from "@maestro-template/app-idea-evaluator";
import * as Either from "effect/Either";

import {
  useTemplateMutation,
  useTemplateQuery,
} from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import {
  useFunnelEventsOnce,
  type FunnelEventTransition,
} from "../../../providers/posthog";
import { loadOwnerAccessToken } from "../report/report-credentials";
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
  return isConvexConfigured() ? (
    <ConfiguredBuildPackGeneratingRoute reportId={reportId} />
  ) : (
    <LocalBuildPackGeneratingRoute reportId={reportId} />
  );
}

export function presentServerPackStatus(input: {
  readonly packId: string;
  readonly status:
    | "running"
    | "failed-recoverable"
    | "needs-support"
    | "completed"
    | "revoked";
  readonly supportId?: string | undefined;
  readonly stages: readonly {
    readonly name: BuildPackStage["name"];
    readonly status: BuildPackStage["status"];
    readonly attempts: number;
    readonly output?: string | undefined;
    readonly error?: string | undefined;
  }[];
}): import("./build-pack-route").BuildPackRouteState {
  if (input.status === "revoked") return { _tag: "revoked" };
  if (
    input.status === "failed-recoverable" ||
    input.status === "needs-support"
  ) {
    return {
      _tag: "failed",
      canRetry: input.status === "failed-recoverable",
      supportId: input.supportId ?? `support_${input.packId}`,
    };
  }
  return {
    _tag: "generating",
    stages: input.stages.map((stage) => ({
      name: stage.name,
      status: stage.status,
      attempts: stage.attempts,
      ...(stage.output === undefined ? {} : { output: stage.output }),
      ...(stage.error === undefined ? {} : { error: stage.error }),
    })),
  };
}

function ConfiguredBuildPackGeneratingRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  const startPack = useTemplateMutation(
    templateConfectRefs.public.buildPacks.packs.startPack,
  );
  const retryPack = useTemplateMutation(
    templateConfectRefs.public.buildPacks.packs.retryFailedStage,
  );
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const [packId, setPackId] = useState<string | null>(null);
  const [fallbackState, setFallbackState] = useState<
    import("./build-pack-route").BuildPackRouteState
  >({ _tag: "generating", stages: [] });
  const started = useRef(false);
  const status = useTemplateQuery(
    templateConfectRefs.public.buildPacks.packs.status,
    packId && ownerAccessToken ? { packId, ownerAccessToken } : "skip",
  );
  const analyticsTransitions: FunnelEventTransition[] = packId
    ? [[`pack:${packId}:started`, { name: "build_pack_started", packId }]]
    : [];
  if (status.status === "ready") {
    for (const stage of status.data.stages) {
      if (
        stage.status !== "completed" &&
        stage.status !== "failed-recoverable" &&
        stage.status !== "needs-support"
      ) {
        continue;
      }
      analyticsTransitions.push([
        `pack:${status.data.packId}:${stage.name}:${stage.status}:${String(stage.attempts)}`,
        {
          name: "build_pack_stage_changed",
          packId: status.data.packId,
          stage: stage.name,
          status: stage.status,
          attempts: stage.attempts,
        },
      ]);
    }
  }
  useFunnelEventsOnce(analyticsTransitions);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!ownerAccessToken) {
      setFallbackState({ _tag: "revoked" });
      return;
    }
    void startPack({ reportId, ownerAccessToken })
      .then((result) => {
        if (Either.isEither(result) && Either.isLeft(result)) {
          throw result.left;
        }
        const startedPack = Either.isEither(result) ? result.right : result;
        setPackId(startedPack.packId);
      })
      .catch(() =>
        setFallbackState({
          _tag: "failed",
          canRetry: false,
          supportId: `support_${reportId}`,
        }),
      );
  }, [ownerAccessToken, reportId, startPack]);

  useEffect(() => {
    if (status.status !== "ready") return;
    if (status.data.status === "completed") {
      window.location.assign(`/build-pack/${status.data.packId}`);
    }
  }, [status]);

  const retry = async () => {
    if (!packId || !ownerAccessToken) return;
    setFallbackState({ _tag: "generating", stages: [] });
    try {
      const result = await retryPack({ packId, ownerAccessToken });
      if (Either.isEither(result) && Either.isLeft(result)) throw result.left;
    } catch {
      setFallbackState({
        _tag: "failed",
        canRetry: false,
        supportId: `support_${packId}`,
      });
    }
  };

  const state =
    status.status === "ready"
      ? presentServerPackStatus(status.data)
      : status.status === "typed_failure" ||
          status.status === "parse_failure" ||
          status.status === "transport_failure" ||
          status.status === "defect"
        ? ({
            _tag: "failed",
            canRetry: false,
            supportId: `support_${packId ?? reportId}`,
          } as const)
        : fallbackState;

  return (
    <BuildPackRouteView
      onRetry={() => void retry()}
      packId={packId ?? reportId}
      state={state}
    />
  );
}

function LocalBuildPackGeneratingRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  const [stored, setStored] = useState<StoredBuildPack | null>(null);
  const [revoked, setRevoked] = useState(false);
  useFunnelEventsOnce(
    stored
      ? [
          [
            `pack:${stored.run.packId}:started`,
            { name: "build_pack_started", packId: stored.run.packId },
          ],
        ]
      : [],
  );

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
