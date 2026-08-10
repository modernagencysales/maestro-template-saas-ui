import type { Ref } from "@confect/core";
import type { TemplateConfectRefs } from "@maestro-template/convex/refs";
import { describe, expect, it } from "vitest";
import {
  fakeDataLifecycleView,
  presentDataLifecycleRequests,
} from "./data-lifecycle-surface";

type ListDsarRequestsRef =
  TemplateConfectRefs["public"]["ops"]["dataLifecycle"]["listDsarRequests"];
type DsarRequestListData = Ref.Returns<ListDsarRequestsRef>;
type DsarRequestListError = Ref.Error<ListDsarRequestsRef>;

const liveRequests = {
  requests: [
    {
      workspaceId: "workspaces_live_1",
      requestId: "dsar_live_export",
      requestedByUserId: "users_live_1",
      subjectId: "customer_live_1",
      kind: "export",
      status: "ready-for-review",
      dryRunOnly: true,
      plannedAt: 1_700_000_000_000,
      confirmation: {
        required: true,
        phrase: "CONFIRM DSAR EXPORT",
        reason: "Operator review is required before fulfillment.",
      },
      exportManifest: [
        {
          resourceId: "brainPages",
          exportMode: "markdown",
          detail: "Brain pages export as markdown.",
        },
      ],
      deletePlan: [
        {
          resourceId: "brainPages",
          deleteMode: "redact",
          executable: false,
          reason: "Dry-run only.",
        },
      ],
    },
  ],
} as unknown as DsarRequestListData;

describe("data lifecycle surface presenter", () => {
  it("keeps an honest fake-safe DSAR view when the live backend is skipped", () => {
    const view = presentDataLifecycleRequests({ status: "skipped" });

    expect(view).toMatchObject({
      live: false,
      status: "unconfigured",
      summary: { total: 0, exportRequests: 0, deleteRequests: 0 },
    });
    expect(view.requests).toEqual([]);
  });

  it("maps live Confect DSAR rows into readable records", () => {
    const view = presentDataLifecycleRequests({
      status: "ready",
      mode: "read",
      data: liveRequests,
    });

    expect(view).toEqual({
      live: true,
      status: "ready",
      requests: [
        {
          id: "dsar_live_export",
          kind: "export",
          status: "ready-for-review",
          subject: "customer_live_1",
          plannedAt: "2023-11-14T22:13:20.000Z",
          exportResources: 1,
          deleteResources: 1,
          dryRunOnly: true,
        },
      ],
      summary: {
        total: 1,
        exportRequests: 1,
        deleteRequests: 0,
        blockedByLegalHold: 0,
      },
    });
  });

  it("keeps fake guidance visible with an unavailable status for typed failures", () => {
    const view = presentDataLifecycleRequests({
      status: "typed_failure",
      error: {
        _tag: "WorkspaceNotFound",
        workspaceId: "workspaces_missing",
      } as unknown as DsarRequestListError,
    });

    expect(view.live).toBe(false);
    expect(view.status).toBe("unavailable");
    expect(view.detail).toBe("WorkspaceNotFound");
    expect(view.requests).toEqual(fakeDataLifecycleView().requests);
  });
});
