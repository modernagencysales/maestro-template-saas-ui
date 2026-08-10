import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { ResizeHandle, Resizer, type ResizeHandler } from "@saas-ui-pro/react";
import {
  AppShell,
  Box,
  Button,
  Card,
  Flex,
  Icon,
  Menu,
  Page,
  Sidebar,
  Stack,
  Text,
} from "@saas-ui/react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  FileCode2,
  FileDown,
  FileText,
  HeartPulse,
  Home,
  KeyRound,
  Map,
  Menu as MenuIcon,
  Plug,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Workflow,
} from "lucide-react";
import { RouteFocusBoundary } from "../navigation/route-ux-boundary";
import { describeRouteAnnouncement } from "../navigation/route-announcements";
import {
  useBrowserNetworkState,
  type WebNetworkState,
} from "../navigation/network-state";
import {
  TEMPLATE_NAV_CATEGORIES,
  TEMPLATE_ROUTE_ITEMS,
  activeTemplateRouteKey,
  type TemplateRouteKey,
} from "../navigation/workspace";
import { DataLifecycleSurface } from "../features/data-lifecycle/data-lifecycle-surface";

const SIDEBAR_WIDTH_KEY = "maestro-sidebar-width";

const navIconByKey = {
  admin: ShieldCheck,
  agents: Users,
  analytics: BarChart3,
  api: FileCode2,
  billing: CreditCard,
  brain: FileText,
  capabilities: KeyRound,
  dataLifecycle: FileDown,
  dataMap: Map,
  documents: FileText,
  health: HeartPulse,
  home: Home,
  integrations: Plug,
  legal: Scale,
  notifications: Bell,
  onboarding: UserRoundCheck,
  runs: Activity,
  settings: Settings,
  sources: Building2,
  workflows: Workflow,
} as const satisfies Record<TemplateRouteKey, ComponentType>;

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
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
      setSearchOpen(true);
      searchTriggerRef.current?.focus();
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
      <Sidebar.Provider>
        <AppShell
          bg="sidebar.bg"
          minH="100dvh"
          sidebar={<ClientResizableSidebar activeKey={activeKey} />}
        >
          <Sidebar.Inset minW="0">
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
                  <Icon as={MenuIcon} />
                </Button>
              </Sidebar.Trigger>
              <Box aria-label="Breadcrumb" as="nav" flex="1" minW="0">
                <Text color="fg.muted" fontSize="sm" truncate>
                  Maestro workspace / {activeRoute?.label ?? "Overview"}
                </Text>
              </Box>
              <Menu.Root
                onOpenChange={({ open }) => setSearchOpen(open)}
                open={searchOpen}
              >
                <Menu.Button
                  aria-keyshortcuts="/"
                  aria-label="Search routes"
                  ref={searchTriggerRef}
                  size="sm"
                  variant="ghost"
                >
                  <Icon as={Search} />
                  <Text display={{ base: "none", md: "inline" }}>Search</Text>
                </Menu.Button>
                <Menu.Content>
                  {TEMPLATE_ROUTE_ITEMS.map((item) => (
                    <Menu.Item asChild key={item.key} value={item.key}>
                      <Link to={item.path}>{item.label}</Link>
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Root>
            </Flex>
            {children}
          </Sidebar.Inset>
        </AppShell>
        <Sidebar.Backdrop />
      </Sidebar.Provider>
    </RouteFocusBoundary>
  );
}

function ClientResizableSidebar({
  activeKey,
}: {
  readonly activeKey: TemplateRouteKey;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <WorkspaceSidebar activeKey={activeKey} />;

  const storedValue = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const storedWidth = storedValue === null ? Number.NaN : Number(storedValue);
  const defaultWidth = Number.isFinite(storedWidth)
    ? Math.min(360, Math.max(232, storedWidth))
    : 272;
  const persistSidebarWidth: ResizeHandler = ({ width }) => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(width)));
  };

  return (
    <Resizer defaultWidth={defaultWidth} enabled onResize={persistSidebarWidth}>
      <WorkspaceSidebar activeKey={activeKey} resizable />
    </Resizer>
  );
}

function WorkspaceSidebar({
  activeKey,
  resizable = false,
}: {
  readonly activeKey: TemplateRouteKey;
  readonly resizable?: boolean;
}) {
  return (
    <Sidebar.Root
      aria-label="Primary navigation"
      maxW={resizable ? "360px" : undefined}
      minW={resizable ? "232px" : undefined}
    >
      <Sidebar.Header gap="2">
        <Menu.Root>
          <Menu.Button
            aria-label="Choose workspace"
            justifyContent="flex-start"
            variant="ghost"
            width="full"
          >
            <Icon as={Building2} />
            <Text flex="1" textAlign="start" truncate>
              Maestro workspace
            </Text>
            <Icon as={ChevronDown} />
          </Menu.Button>
          <Menu.Content>
            <Menu.Item value="current">Maestro workspace</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Sidebar.Header>
      <Sidebar.Body>
        <Stack as="nav" aria-label="Primary navigation" gap="4">
          {TEMPLATE_NAV_CATEGORIES.map((category) => (
            <Sidebar.Group key={category.label}>
              <Sidebar.GroupHeader>
                <Sidebar.GroupTitle>{category.label}</Sidebar.GroupTitle>
              </Sidebar.GroupHeader>
              <Sidebar.GroupContent>
                {category.items.map((item) => {
                  const IconComponent = navIconByKey[item.key];

                  return (
                    <Sidebar.NavItem key={item.key}>
                      <Sidebar.NavButton
                        asChild
                        data-active={item.key === activeKey ? "" : undefined}
                      >
                        <Link to={item.path}>
                          <Icon as={IconComponent} />
                          <Text truncate>{item.label}</Text>
                        </Link>
                      </Sidebar.NavButton>
                    </Sidebar.NavItem>
                  );
                })}
              </Sidebar.GroupContent>
            </Sidebar.Group>
          ))}
        </Stack>
      </Sidebar.Body>
      <Sidebar.Footer>
        <Menu.Root>
          <Menu.Button
            aria-label="Open user menu"
            justifyContent="flex-start"
            variant="ghost"
            width="full"
          >
            <Icon as={UserRoundCheck} />
            <Text flex="1" textAlign="start" truncate>
              Template user
            </Text>
            <Icon as={ChevronDown} />
          </Menu.Button>
          <Menu.Content>
            <Menu.Item asChild value="settings">
              <Link to="/settings">Settings</Link>
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
        {resizable ? (
          <Sidebar.Track asChild>
            <ResizeHandle aria-label="Resize navigation" />
          </Sidebar.Track>
        ) : null}
      </Sidebar.Footer>
    </Sidebar.Root>
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
