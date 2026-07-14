import { TEMPLATE_ROUTE_ITEMS } from "./workspace";

const routeTitles = new Map<string, string>(
  TEMPLATE_ROUTE_ITEMS.map((item) => [item.path, item.label]),
);

export function describeRouteAnnouncement(pathname: string, hash = ""): string {
  const normalizedHash = hash.replace(/^#/, "");
  const hashTitle = normalizedHash
    ? TEMPLATE_ROUTE_ITEMS.find((item) => item.path === `/${normalizedHash}`)
        ?.label
    : undefined;
  const title = hashTitle ?? routeTitles.get(pathname) ?? "Unknown route";

  return `Viewing ${title}`;
}
