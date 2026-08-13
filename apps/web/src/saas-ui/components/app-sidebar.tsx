import { useEffect, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { ResizeHandle, Resizer, type ResizeHandler } from "@saas-ui-pro/react";
import { Icon, Sidebar, Stack, Text, useSidebar } from "@saas-ui/react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileCode2,
  FileDown,
  FileText,
  HeartPulse,
  Home,
  KeyRound,
  Map,
  Plug,
  Scale,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Workflow,
} from "lucide-react";
import {
  TEMPLATE_NAV_CATEGORIES,
  type TemplateRouteKey,
} from "../../navigation/workspace";
import { UserMenu } from "./user-menu";
import { WorkspacesMenu } from "./workspaces-menu";

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

// Adapted from the starter app-sidebar and Pro sidebar1 at the pinned commits.
export function AppSidebar({
  activeKey,
}: {
  readonly activeKey: TemplateRouteKey;
}) {
  const { isMobile, open } = useSidebar();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const storedWidth = mounted
    ? Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY))
    : Number.NaN;
  const defaultWidth = Number.isFinite(storedWidth)
    ? Math.min(360, Math.max(232, storedWidth))
    : 272;
  const persistWidth: ResizeHandler = ({ width }) =>
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(width)));

  return (
    <Resizer
      defaultWidth={defaultWidth}
      enabled={mounted && !isMobile && open}
      onResize={persistWidth}
    >
      <Sidebar.Root aria-label="Primary navigation">
        <Sidebar.Header gap="2">
          <WorkspacesMenu />
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
          <UserMenu />
          <Sidebar.Track asChild>
            <ResizeHandle aria-label="Resize navigation" />
          </Sidebar.Track>
        </Sidebar.Footer>
      </Sidebar.Root>
    </Resizer>
  );
}
