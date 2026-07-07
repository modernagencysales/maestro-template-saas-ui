import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildLocalizedPlatformLabels,
  filterCommandPaletteItems,
} from "./command-palette";
import { TemplateNotificationCenter } from "./notification-center";

const read = (path: string): string => readFileSync(path, "utf8");

describe("frontend platform primitives", () => {
  it("filters command palette route and action commands without backend SDK imports", () => {
    const commands = [
      {
        id: "route.workflows",
        label: "Workflows",
        keywords: ["workflow", "run", "agent"],
        kind: "route" as const,
        href: "/workflows",
      },
      {
        id: "action.invite",
        label: "Invite teammate",
        keywords: ["team", "member", "seat"],
        kind: "action" as const,
      },
    ];

    expect(filterCommandPaletteItems(commands, "agent")).toEqual([commands[0]]);
    expect(filterCommandPaletteItems(commands, "seat")).toEqual([commands[1]]);

    const source = read("src/platform/command-palette.tsx");

    expect(source).not.toContain("@notion-kit");
    expect(source).toContain("../primitives");
    expect(source).not.toContain("convex/");
    expect(source).not.toContain("@confect/");
  });

  it("renders localized command labels", () => {
    expect(
      buildLocalizedPlatformLabels({
        locale: "en-US",
        commandPlaceholder: "Search commands",
        emptyCommandLabel: "No commands found",
      }),
    ).toEqual({
      locale: "en-US",
      commandPlaceholder: "Search commands",
      emptyCommandLabel: "No commands found",
    });
  });

  it("declares notification center empty, fake, test, and live delivery states", () => {
    const source = read("src/platform/notification-center.tsx");

    expect(source).not.toContain("@notion-kit");
    expect(source).toContain("../primitives");
    expect(source).toContain("No notifications yet");
    expect(source).toContain("fake");
    expect(source).toContain("test");
    expect(source).toContain("live-ready");
  });

  it("renders notification read state, actions, and preference channels", () => {
    const html = renderToStaticMarkup(
      <TemplateNotificationCenter
        notifications={[
          {
            id: "notification_1",
            title: "Workflow completed",
            body: "The launch flow is ready.",
            category: "workflow",
            priority: "normal",
            delivery: "fake",
            createdAt: "2026-07-05T14:00:00.000Z",
            actionHref: "/runs/run_1",
          },
          {
            id: "notification_2",
            title: "Security reviewed",
            body: "The provider posture was approved.",
            category: "security",
            priority: "high",
            delivery: "test",
            createdAt: "2026-07-05T13:00:00.000Z",
            readAt: "2026-07-05T13:05:00.000Z",
          },
        ]}
        preferences={[
          {
            category: "workflow",
            inApp: true,
            email: false,
            digest: true,
          },
        ]}
        summary={{
          total: 2,
          unread: 1,
          mutedCategories: [],
          liveDeliveryReady: false,
        }}
        onMarkRead={() => undefined}
      />,
    );

    expect(html).toContain("1 unread");
    expect(html).toContain("template-notification-row unread");
    expect(html).toContain("Mark read");
    expect(html).toContain('href="/runs/run_1"');
    expect(html).toContain("Email off");
    expect(html).toContain("Digest on");
  });

  it("declares onboarding checklist and missing live provider setup states", () => {
    const source = read("src/platform/onboarding.tsx");

    expect(source).not.toContain("@notion-kit");
    expect(source).toContain("../primitives");
    expect(source).toContain("TemplateOnboardingChecklist");
    expect(source).toContain("missingEnv");
    expect(source).toContain("onContinue");
    expect(source).toContain("onClick={onContinue}");
    expect(source).toContain("fake mode");
    expect(source).toContain("live provider setup");
  });
});
