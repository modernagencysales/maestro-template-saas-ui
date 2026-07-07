export type TemplateRouteKey =
  | "home"
  | "brain"
  | "workflows"
  | "capabilities"
  | "agents"
  | "runs"
  | "documents"
  | "sources"
  | "integrations"
  | "api"
  | "onboarding"
  | "dataMap"
  | "dataLifecycle"
  | "notifications"
  | "settings"
  | "legal"
  | "billing"
  | "analytics"
  | "health"
  | "admin";

export type TemplateRouteItem = {
  readonly key: TemplateRouteKey;
  readonly label: string;
  readonly path: string;
  readonly icon: string;
  readonly description: string;
};

export type TemplateNavCategory = {
  readonly label: string;
  readonly defaultExpanded?: boolean;
  readonly items: readonly TemplateRouteItem[];
};

export const TEMPLATE_ROUTE_ITEMS: readonly TemplateRouteItem[] = [
  {
    key: "home",
    label: "Overview",
    path: "/",
    icon: "M",
    description: "Template story, delivery leverage, and operating model.",
  },
  {
    key: "brain",
    label: "Brain",
    path: "/brain",
    icon: "B",
    description: "Source-backed company context and context packs.",
  },
  {
    key: "workflows",
    label: "Workflows",
    path: "/workflows",
    icon: "W",
    description: "Composable business processes with typed runtime contracts.",
  },
  {
    key: "capabilities",
    label: "Capabilities",
    path: "/capabilities",
    icon: "C",
    description: "Safe, audited actions exposed to agents and humans.",
  },
  {
    key: "agents",
    label: "Agents",
    path: "/agents",
    icon: "A",
    description: "Bounded non-deterministic actors with explicit grants.",
  },
  {
    key: "runs",
    label: "Runs",
    path: "/runs",
    icon: "R",
    description: "Workflow execution history, receipts, and review state.",
  },
  {
    key: "documents",
    label: "Documents",
    path: "/documents",
    icon: "D",
    description: "Markdown, notes, and authored client knowledge.",
  },
  {
    key: "sources",
    label: "Sources",
    path: "/sources",
    icon: "S",
    description: "Links, files, approved source sets, and evidence.",
  },
  {
    key: "integrations",
    label: "Integrations",
    path: "/integrations",
    icon: "I",
    description: "Provider adapters for client systems and SaaS services.",
  },
  {
    key: "api",
    label: "API / CLI / MCP",
    path: "/api",
    icon: "/",
    description: "Shared operation registry projected into headless surfaces.",
  },
  {
    key: "onboarding",
    label: "Onboarding",
    path: "/onboarding",
    icon: "O",
    description: "Client setup, domain intake, and readiness checklist.",
  },
  {
    key: "dataMap",
    label: "Data Map",
    path: "/data-map",
    icon: "#",
    description: "Tenant data inventory, classifications, and retention.",
  },
  {
    key: "dataLifecycle",
    label: "Data Lifecycle",
    path: "/data-lifecycle",
    icon: "P",
    description:
      "Dry-run DSAR planning, request audit rows, and retention posture.",
  },
  {
    key: "notifications",
    label: "Notifications",
    path: "/notifications",
    icon: "N",
    description: "Email and event messages with fake/local defaults.",
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    icon: "T",
    description: "Workspace settings, business preferences, and tenancy.",
  },
  {
    key: "legal",
    label: "Legal",
    path: "/legal",
    icon: "L",
    description: "Client-specific legal review drafts for launch signoff.",
  },
  {
    key: "billing",
    label: "Billing",
    path: "/billing",
    icon: "$",
    description: "Customer billing adapter and entitlement model.",
  },
  {
    key: "analytics",
    label: "Analytics",
    path: "/analytics",
    icon: "%",
    description: "PostHog-ready product telemetry and operational metrics.",
  },
  {
    key: "health",
    label: "Health",
    path: "/health",
    icon: "+",
    description: "Provider posture, queues, smoke checks, and release status.",
  },
  {
    key: "admin",
    label: "Admin",
    path: "/admin",
    icon: "*",
    description: "Audit, support, policy, and internal operator controls.",
  },
] as const;

export const TEMPLATE_NAV_CATEGORIES: readonly TemplateNavCategory[] = [
  {
    label: "Build",
    defaultExpanded: true,
    items: TEMPLATE_ROUTE_ITEMS.filter((item) =>
      ["home", "brain", "documents", "sources", "onboarding"].includes(
        item.key,
      ),
    ),
  },
  {
    label: "Operate",
    defaultExpanded: true,
    items: TEMPLATE_ROUTE_ITEMS.filter((item) =>
      [
        "workflows",
        "capabilities",
        "agents",
        "runs",
        "integrations",
        "api",
      ].includes(item.key),
    ),
  },
  {
    label: "Control",
    defaultExpanded: true,
    items: TEMPLATE_ROUTE_ITEMS.filter((item) =>
      [
        "dataMap",
        "dataLifecycle",
        "notifications",
        "settings",
        "legal",
        "billing",
        "analytics",
        "health",
        "admin",
      ].includes(item.key),
    ),
  },
] as const;

export function activeTemplateRouteKey(
  pathname: string,
): TemplateRouteKey | null {
  const normalized = pathname.split(/[?#]/, 1)[0] || "/";
  const matches = TEMPLATE_ROUTE_ITEMS.filter((item) => {
    if (item.path === "/") {
      return normalized === "/";
    }

    return normalized === item.path || normalized.startsWith(`${item.path}/`);
  }).sort((a, b) => b.path.length - a.path.length);

  return matches[0]?.key ?? null;
}
