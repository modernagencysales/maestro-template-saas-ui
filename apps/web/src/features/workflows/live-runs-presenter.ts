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

export const presentLiveRuns = (
  state: TemplateDataState<LiveRunsOverview, unknown>,
): LiveRunsView => {
  switch (state.status) {
    case "skipped":
      return { kind: "unconfigured" };
    case "loading":
      return { kind: "connecting" };
    case "typed_failure":
      return { kind: "unavailable", detail: "The backend returned an error." };
    case "parse_failure":
    case "transport_failure":
    case "defect":
      return { kind: "unavailable", detail: state.message };
    case "empty":
    case "ready": {
      if (state.data.workspace === null) {
        return { kind: "unseeded" };
      }
      return {
        kind: "ready",
        workspaceName: state.data.workspace.name,
        runCount: state.data.workflowRuns.length,
        rows: [...state.data.workflowRuns]
          .sort((a, b) => b.startedAt - a.startedAt)
          .map((run) => ({
            key: run._id,
            workflowId: run.workflowId,
            workflowVersion: run.workflowVersion,
            status: run.status,
            startedAtLabel: new Date(run.startedAt).toISOString(),
          })),
      };
    }
  }
};
