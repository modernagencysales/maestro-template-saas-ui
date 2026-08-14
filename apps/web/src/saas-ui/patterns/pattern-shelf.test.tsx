import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as patterns from "./index";
import { moveBoardItem } from "./data-board";
import { reorderTasks } from "./sortable-task-list";
import { PageStateView } from "./page-states";
import { MaestroSaasUiProvider } from "../provider";

const patternsRoot = fileURLToPath(new URL("./", import.meta.url));
const patternFiles = [
  "page-states",
  "collection-grid",
  "data-filters",
  "record-list-detail",
  "record-aside",
  "activity-timeline",
  "split-page",
  "form-section",
  "report",
  "analytics-chart",
  "data-board",
  "onboarding-steps",
  "integration-card",
  "notification-settings",
  "member-list",
  "kpi-card",
  "task-card",
  "file-card",
  "files-list-card",
  "latest-message-card",
  "sortable-task-list",
  "add-contact-drawer",
  "invite-people-dialog",
  "select-users-dialog",
  "manage-tags-dialog",
  "roles-menu",
  "stacked-navigation",
  "pricing-table",
  "billing-status",
  "payment-overdue-banner",
  "file-upload",
] as const;

describe("Saas UI pattern shelf", () => {
  it("compiles every exported pattern through one table", () => {
    const exports = [
      "ActivityTimeline",
      "AddContactDrawer",
      "AnalyticsChart",
      "BillingStatus",
      "CollectionGrid",
      "DataBoard",
      "DataFilters",
      "FileCard",
      "FileUpload",
      "FilesListCard",
      "FormSection",
      "IntegrationCard",
      "InvitePeopleDialog",
      "KpiCard",
      "LatestMessageCard",
      "ManageTagsDialog",
      "MemberList",
      "NotificationSettings",
      "OnboardingSteps",
      "PageStateView",
      "PaymentOverdueBanner",
      "PricingTable",
      "RecordAside",
      "RecordListDetail",
      "Report",
      "RolesMenu",
      "SelectUsersDialog",
      "SortableTaskList",
      "SplitPage",
      "StackedNavigation",
      "StateNotice",
      "TaskCard",
    ] as const;

    for (const name of exports)
      expect(patterns[name], name).toBeTypeOf("function");
  });

  it("checks in and exports every approved live and ready-source pattern", () => {
    const index = readFileSync(`${patternsRoot}/index.ts`, "utf8");

    for (const pattern of patternFiles) {
      expect(existsSync(`${patternsRoot}/${pattern}.tsx`), pattern).toBe(true);
      expect(index).toContain(`./${pattern}`);
    }
  });

  it("keeps adapted source provider-free and provenance-pinned", () => {
    for (const pattern of patternFiles) {
      const source = readFileSync(`${patternsRoot}/${pattern}.tsx`, "utf8");
      expect(source).toMatch(/Adapted from|Derived from/);
      expect(source).not.toMatch(
        /\b(?:trpc|useQuery|useMutation|seed|mock)\b/iu,
      );
    }
  });

  it("renders every truthful page state with an announced status", () => {
    const html = [
      "loading",
      "empty",
      "read",
      "edit",
      "success",
      "failure",
      "not-found",
    ].map((state) =>
      renderToStaticMarkup(
        <MaestroSaasUiProvider>
          <PageStateView
            description="State detail"
            state={state as patterns.PageState}
            title="Records"
          >
            Ready content
          </PageStateView>
        </MaestroSaasUiProvider>,
      ),
    );

    expect(
      html.every((markup) => /role="(?:status|alert)"/u.test(markup)),
    ).toBe(true);
    expect(html[2]).toContain("Ready content");
    expect(html[3]).toContain("Ready content");
  });

  it("supports deterministic keyboard reorder outcomes without provider activity", () => {
    expect(
      moveBoardItem(
        [{ id: "one", title: "One", columnId: "todo" }],
        "one",
        "done",
      ),
    ).toEqual([{ id: "one", title: "One", columnId: "done" }]);
    expect(
      reorderTasks(
        [
          { id: "one", title: "One" },
          { id: "two", title: "Two" },
        ],
        1,
        0,
      ).map((task) => task.id),
    ).toEqual(["two", "one"]);
  });

  it("delegates overlay focus return and exposes a native file callback boundary", () => {
    expect(
      readFileSync(`${patternsRoot}/invite-people-dialog.tsx`, "utf8"),
    ).toContain("Dialog.ActionTrigger");
    expect(
      readFileSync(`${patternsRoot}/add-contact-drawer.tsx`, "utf8"),
    ).toContain("Drawer.CloseTrigger");
    const upload = readFileSync(`${patternsRoot}/file-upload.tsx`, "utf8");
    expect(upload).toContain("FileUpload.Root");
    expect(upload).toContain("FileUpload.Trigger");
    expect(upload).toContain("FileUpload.List");
    expect(upload).toContain("onAccept");
    expect(upload).toContain("clearable");
  });
});
