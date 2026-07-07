import {
  TEMPLATE_ROUTE_ITEMS,
  type TemplateRouteItem,
  type TemplateRouteKey,
} from "./workspace";

type ReferenceAppRoute = {
  readonly key: TemplateRouteKey;
  readonly pageId: string;
  readonly navigationLabel?: string;
  readonly navigationHint?: string;
  readonly announcementTitle?: string;
};

export const REFERENCE_APP_ROUTES: readonly ReferenceAppRoute[] = [
  { key: "home", pageId: "overview" },
  { key: "brain", pageId: "brain" },
  { key: "workflows", pageId: "workflows" },
  { key: "capabilities", pageId: "capabilities" },
  { key: "agents", pageId: "agents" },
  { key: "runs", pageId: "runs", announcementTitle: "Workflow runs" },
  { key: "documents", pageId: "documents" },
  { key: "sources", pageId: "sources" },
  {
    key: "api",
    pageId: "headless",
    navigationHint: "Scalar",
    announcementTitle: "API and MCP",
  },
  { key: "onboarding", pageId: "onboarding" },
  { key: "dataMap", pageId: "data-map", announcementTitle: "Data map" },
  { key: "notifications", pageId: "notifications" },
  { key: "integrations", pageId: "integrations" },
  { key: "settings", pageId: "settings" },
  { key: "legal", pageId: "legal" },
  { key: "billing", pageId: "billing" },
  { key: "analytics", pageId: "analytics" },
  {
    key: "health",
    pageId: "safety",
    navigationLabel: "Health",
    announcementTitle: "Health",
  },
  { key: "admin", pageId: "admin" },
] as const satisfies readonly ReferenceAppRoute[];

const routeItemByKey = new Map<TemplateRouteKey, TemplateRouteItem>(
  TEMPLATE_ROUTE_ITEMS.map((item) => [item.key, item]),
);

export const referenceAppPageIdByRouteKey = new Map<string, string>(
  REFERENCE_APP_ROUTES.map((route) => [route.key, route.pageId]),
);

export const referenceAppRouteKeyByPageId = new Map<string, TemplateRouteKey>(
  REFERENCE_APP_ROUTES.map((route) => [route.pageId, route.key]),
);

export function referenceAppRouteHashForKey(key: TemplateRouteKey): string {
  return `#${referenceAppPageIdByRouteKey.get(key) ?? key}`;
}

export function referenceAppNavigationLabel(key: TemplateRouteKey): string {
  const route = REFERENCE_APP_ROUTES.find((candidate) => candidate.key === key);

  return route?.navigationLabel ?? routeItemByKey.get(key)?.label ?? key;
}

export function referenceAppNavigationHint(
  key: TemplateRouteKey,
): string | undefined {
  return REFERENCE_APP_ROUTES.find((route) => route.key === key)
    ?.navigationHint;
}

export function referenceAppAnnouncementTitleForPageId(
  pageId: string,
): string | undefined {
  const route = REFERENCE_APP_ROUTES.find(
    (candidate) => candidate.pageId === pageId,
  );

  if (!route) {
    return undefined;
  }

  return route.announcementTitle ?? referenceAppNavigationLabel(route.key);
}
