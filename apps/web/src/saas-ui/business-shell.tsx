import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Box, Button, Card, Flex, Page, Sidebar, Text } from "@saas-ui/react";
import { RouteFocusBoundary } from "../navigation/route-ux-boundary";
import { describeRouteAnnouncement } from "../navigation/route-announcements";
import {
  useBrowserNetworkState,
  type WebNetworkState,
} from "../navigation/network-state";
import {
  TEMPLATE_ROUTE_ITEMS,
  activeTemplateRouteKey,
} from "../navigation/workspace";
import { DataLifecycleSurface } from "../features/data-lifecycle/data-lifecycle-surface";
import { GlobalSearchInput } from "./components/global-search-input";
import { DashboardLayout } from "./layouts/dashboard-layout";

const sectionDetails = {
  admin: ["Admin", "Workspace controls and audited operating posture."],
  agents: ["Agents", "Operators and bounded automated assistants."],
  analytics: ["Analytics", "Product and operational measurement."],
  api: ["API / CLI / MCP", "Headless access to the shared operation registry."],
  billing: [
    "Billing",
    "Commercial status supplied by an owned billing adapter.",
  ],
  brain: ["Brain", "Approved sources and grounded context."],
  capabilities: [
    "Capabilities",
    "Reviewed actions available to people and agents.",
  ],
  dataMap: ["Data map", "Owned systems, entities, and downstream consumers."],
  documents: ["Documents", "Customer-facing and internal authored knowledge."],
  health: ["Health", "Provider and application operating posture."],
  integrations: ["Integrations", "Connections to owned customer systems."],
  legal: ["Legal", "Client-reviewed policy and agreement surfaces."],
  notifications: ["Notifications", "Provider-neutral delivery preferences."],
  onboarding: ["Onboarding", "Setup work for an owned customer journey."],
  runs: ["Runs", "Workflow outcomes, receipts, and exceptions."],
  sources: ["Sources", "Approved evidence and source freshness."],
  workflows: ["Workflows", "Typed business processes and their execution."],
} as const;

export type BusinessSectionKey = keyof typeof sectionDetails;

export function BusinessAppShell({
  children,
  networkState: networkStateOverride,
  pathname,
}: {
  readonly children: ReactNode;
  readonly networkState?: WebNetworkState;
  readonly pathname: string;
}) {
  const browserNetworkState = useBrowserNetworkState();
  const networkState = networkStateOverride ?? browserNetworkState;
  const activeKey = activeTemplateRouteKey(pathname) ?? "home";
  const activeRoute = TEMPLATE_ROUTE_ITEMS.find(
    (item) => item.key === activeKey,
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "/" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      event.preventDefault();
      document
        .querySelector<HTMLInputElement>('[aria-label="Search routes"]')
        ?.focus();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const retryCurrentRoute = useCallback(() => window.location.reload(), []);
  return (
    <RouteFocusBoundary
      announcement={describeRouteAnnouncement(pathname)}
      focusKey={pathname}
      networkAction={retryCurrentRoute}
      networkState={networkState}
    >
      <DashboardLayout activeKey={activeKey}>
        <Flex
          align="center"
          as="header"
          borderBottomWidth="1px"
          gap="3"
          minH="12"
          px={{ base: "3", md: "4" }}
        >
          <Sidebar.Trigger asChild>
            <Button
              aria-label="Open navigation"
              display={{ base: "inline-flex", lg: "none" }}
              size="sm"
              variant="ghost"
            >
              Menu
            </Button>
          </Sidebar.Trigger>
          <Box aria-label="Breadcrumb" as="nav" flex="1" minW="0">
            <Text color="fg.muted" fontSize="sm" truncate>
              Maestro workspace / {activeRoute?.label ?? "Overview"}
            </Text>
          </Box>
          <Box maxW="xs" position="relative" width="full">
            <GlobalSearchInput onChange={setSearchQuery} value={searchQuery} />
            {searchQuery ? (
              <Card.Root
                position="absolute"
                top="calc(100% + 0.5rem)"
                width="full"
                zIndex="dropdown"
              >
                <Card.Body gap="1">
                  {TEMPLATE_ROUTE_ITEMS.filter((item) =>
                    item.label
                      .toLocaleLowerCase()
                      .includes(searchQuery.toLocaleLowerCase()),
                  ).map((item) => (
                    <Button
                      asChild
                      justifyContent="flex-start"
                      key={item.key}
                      variant="ghost"
                    >
                      <Link to={item.path}>{item.label}</Link>
                    </Button>
                  ))}
                </Card.Body>
              </Card.Root>
            ) : null}
          </Box>
        </Flex>
        {children}
      </DashboardLayout>
    </RouteFocusBoundary>
  );
}

export function BusinessPageRoot({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <Page.Root
      as="main"
      id="workspace-main"
      minH="calc(100dvh - var(--chakra-sizes-12))"
      tabIndex={-1}
    >
      {children}
    </Page.Root>
  );
}

function TruthfulEmptyState({ description }: { readonly description: string }) {
  return (
    <Card.Root maxW="2xl">
      <Card.Body gap="2">
        <Text fontWeight="semibold">No connected data yet</Text>
        <Text color="fg.muted">{description}</Text>
      </Card.Body>
    </Card.Root>
  );
}

export function BusinessDashboardRoute() {
  return (
    <BusinessPageRoot>
      <Page.Header
        description="Connect the first owned business slice to populate this workspace."
        title="Overview"
      />
      <Page.Body px={{ base: "4", md: "6" }} py="6">
        <TruthfulEmptyState description="The template does not invent pipeline, account, or task records." />
      </Page.Body>
    </BusinessPageRoot>
  );
}

export function BusinessSectionRoute({
  section,
}: {
  readonly section: BusinessSectionKey;
}) {
  const [title, description] = sectionDetails[section];

  return (
    <BusinessPageRoot>
      <Page.Header description={description} title={title} />
      <Page.Body px={{ base: "4", md: "6" }} py="6">
        <TruthfulEmptyState
          description={`No ${title.toLocaleLowerCase()} source is connected.`}
        />
      </Page.Body>
    </BusinessPageRoot>
  );
}

export function BusinessDataLifecycleRoute() {
  return (
    <BusinessPageRoot>
      <Page.Header
        description="A visible Confect query and mutation slice with fake-safe local behavior."
        title="Data lifecycle"
      />
      <Page.Body px={{ base: "4", md: "6" }} py="6">
        <DataLifecycleSurface />
      </Page.Body>
    </BusinessPageRoot>
  );
}
