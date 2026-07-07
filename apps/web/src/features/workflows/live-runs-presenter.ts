import type { TemplateDataState } from "../../adapters/confect-state";

/**
 * Pure presenter for the live workflow-runs panel. Maps the normalized
 * Convex query state onto an exhaustive view model so the component stays
 * a dumb renderer and every state (including "backend not configured",
 * which static/local builds hit) is testable without a client.
 */

export type LiveRunsOverview = {
  readonly workspace: { readonly name: string } | null;
  readonly workflowRuns: readonly {
    readonly _id: string;
    readonly workflowId: string;
    readonly workflowVersion: number;
    readonly status: string;
    readonly startedAt: number;
  }[];
};

export type LiveRunRow = {
  readonly key: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly status: string;
  readonly startedAtLabel: string;
};

export type LiveRunsView =
  | { readonly kind: "unconfigured" }
  | { readonly kind: "connecting" }
  | { readonly kind: "unavailable"; readonly detail: string }
  | { readonly kind: "unseeded" }
  | {
      readonly kind: "ready";
      readonly workspaceName: string;
      readonly runCount: number;
      readonly rows: readonly LiveRunRow[];
    };

const liveRunsStaticViewByStatus = {
  loading: { kind: "connecting" },
  skipped: { kind: "unconfigured" },
  typed_failure: {
    kind: "unavailable",
    detail: "The backend returned an error.",
  },
} as const satisfies Partial<
  Record<TemplateDataState<LiveRunsOverview, unknown>["status"], LiveRunsView>
>;

const presentUnavailableLiveRuns = (
  state: Extract<
    TemplateDataState<LiveRunsOverview, unknown>,
    { readonly status: "defect" | "parse_failure" | "transport_failure" }
  >,
): LiveRunsView => ({ kind: "unavailable", detail: state.message });

const presentReadyLiveRuns = (data: LiveRunsOverview): LiveRunsView => {
  if (data.workspace === null) {
    return { kind: "unseeded" };
  }

  return {
    kind: "ready",
    workspaceName: data.workspace.name,
    runCount: data.workflowRuns.length,
    rows: [...data.workflowRuns]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((run) => ({
        key: run._id,
        workflowId: run.workflowId,
        workflowVersion: run.workflowVersion,
        status: run.status,
        startedAtLabel: new Date(run.startedAt).toISOString(),
      })),
  };
};

export const presentLiveRuns = (
  state: TemplateDataState<LiveRunsOverview, unknown>,
): LiveRunsView => {
  if (state.status === "empty" || state.status === "ready") {
    return presentReadyLiveRuns(state.data);
  }

  if (
    state.status === "parse_failure" ||
    state.status === "transport_failure" ||
    state.status === "defect"
  ) {
    return presentUnavailableLiveRuns(state);
  }

  return liveRunsStaticViewByStatus[state.status];
};
