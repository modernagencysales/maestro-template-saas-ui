import { referenceAppAnnouncementTitleForPageId } from "./reference-app-routes";

const routeTitles = new Map<string, string>([
  ["/", "Overview"],
  ["/agents", "Agents"],
  ["/analytics", "Analytics"],
  ["/api", "API and MCP"],
  ["/billing", "Billing"],
  ["/brain", "Brain"],
  ["/capabilities", "Capabilities"],
  ["/data-lifecycle", "Data Lifecycle"],
  ["/data-map", "Data map"],
  ["/documents", "Documents"],
  ["/health", "Health"],
  ["/integrations", "Integrations"],
  ["/legal", "Legal"],
  ["/notifications", "Notifications"],
  ["/onboarding", "Onboarding"],
  ["/runs", "Workflow runs"],
  ["/settings", "Settings"],
  ["/sources", "Sources"],
  ["/workflows", "Workflows"],
]);

export function describeRouteAnnouncement(pathname: string, hash = ""): string {
  const hashPageId = hash.replace(/^#/, "");
  const title =
    (pathname === "/"
      ? referenceAppAnnouncementTitleForPageId(hashPageId)
      : undefined) ??
    routeTitles.get(pathname) ??
    "Unknown route";

  return `Viewing ${title}`;
}
