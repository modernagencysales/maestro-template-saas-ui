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
  ["/dashboard", "Overview"],
  ["/documents", "Documents"],
  ["/evaluate", "Evaluate your app idea"],
  ["/health", "Health"],
  ["/integrations", "Integrations"],
  ["/legal", "Legal"],
  ["/library", "Report library"],
  ["/notifications", "Notifications"],
  ["/onboarding", "Onboarding"],
  ["/runs", "Workflow runs"],
  ["/settings", "Settings"],
  ["/sources", "Sources"],
  ["/support", "Support"],
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/verify-report", "Verify report"],
  ["/workflows", "Workflows"],
]);

export function describeRouteAnnouncement(pathname: string, hash = ""): string {
  const hashPageId = hash.replace(/^#/, "");
  const dynamicTitle = [
    ["/build-pack/", "Build pack"],
    ["/checkout/", "Checkout"],
    ["/maestro/", "Maestro offer"],
    ["/report/", "Report"],
    ["/share/", "Shared report"],
  ].find(([prefix]) => pathname.startsWith(prefix ?? ""))?.[1];
  const title =
    (pathname === "/"
      ? referenceAppAnnouncementTitleForPageId(hashPageId)
      : undefined) ??
    routeTitles.get(pathname) ??
    dynamicTitle ??
    "Unknown route";

  return `Viewing ${title}`;
}
