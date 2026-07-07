import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Page,
  Separator,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@saas-ui/react";
import {
  TEMPLATE_NAV_CATEGORIES,
  TEMPLATE_ROUTE_ITEMS,
  type TemplateRouteKey,
} from "../navigation/workspace";
import { DataLifecycleSurface } from "../features/data-lifecycle/data-lifecycle-surface";
import { LiveWorkflowRunsPanel } from "../features/workflows/live-runs-panel";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  FileCode2,
  FileDown,
  FileText,
  HeartPulse,
  Home,
  KeyRound,
  LifeBuoy,
  Lock,
  Map,
  Plug,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Workflow,
} from "lucide-react";

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

const metrics = [
  { label: "Pipeline", value: "$428K", delta: "+12.4%" },
  { label: "Active workflows", value: "37", delta: "+6 this week" },
  { label: "Accounts touched", value: "184", delta: "82% SLA" },
  { label: "Tasks due", value: "19", delta: "7 high priority" },
] as const;

const accounts = [
  {
    name: "Northstar Labs",
    owner: "Avery Stone",
    stage: "Proposal",
    health: "Strong",
  },
  {
    name: "Kinetic Cloud",
    owner: "Morgan Lee",
    stage: "Discovery",
    health: "Watch",
  },
  {
    name: "Fieldwire Systems",
    owner: "Jordan Kim",
    stage: "Pilot",
    health: "Strong",
  },
] as const;

const tasks = [
  "Review proposal edits for Northstar Labs",
  "Approve enrichment workflow changes",
  "Send onboarding plan to Fieldwire Systems",
] as const;

const goldenPath = [
  "TanStack Start owns routing and SSR query wiring.",
  "Confect React hooks own Convex server state.",
  "Effect runtime execution stays inside approved adapters.",
  "Saas UI owns the visible business app surface.",
] as const;

const sectionDetails = {
  admin: {
    title: "Admin",
    description:
      "Govern workspace controls, audit posture, and operating standards.",
    icon: ShieldCheck,
    metric: "8 controls",
    status: "Healthy",
  },
  agents: {
    title: "Team",
    description:
      "Manage operators, automated assistants, and account ownership.",
    icon: Users,
    metric: "14 members",
    status: "Active",
  },
  analytics: {
    title: "Analytics",
    description:
      "Track revenue movement, workflow throughput, and conversion signals.",
    icon: BarChart3,
    metric: "24 reports",
    status: "Live",
  },
  api: {
    title: "API",
    description:
      "Review keys, webhooks, and integration usage for external systems.",
    icon: FileCode2,
    metric: "6 endpoints",
    status: "Ready",
  },
  billing: {
    title: "Billing",
    description: "Plan usage, invoices, and commercial workspace details.",
    icon: CreditCard,
    metric: "Pro plan",
    status: "Current",
  },
  brain: {
    title: "Brain",
    description: "Organize shared knowledge and approved source context.",
    icon: FileText,
    metric: "42 notes",
    status: "Indexed",
  },
  capabilities: {
    title: "Capabilities",
    description:
      "Catalog approved enrichment, routing, and execution capabilities.",
    icon: KeyRound,
    metric: "18 approved",
    status: "Reviewed",
  },
  dataLifecycle: {
    title: "Data lifecycle",
    description: "Monitor retention, sync status, and governed data movement.",
    icon: FileDown,
    metric: "99.9% sync",
    status: "Compliant",
  },
  dataMap: {
    title: "Data map",
    description:
      "Map source systems, entities, ownership, and downstream consumers.",
    icon: Database,
    metric: "11 systems",
    status: "Mapped",
  },
  documents: {
    title: "Documents",
    description:
      "Store customer-facing plans, proposals, and implementation notes.",
    icon: FileText,
    metric: "32 docs",
    status: "Organized",
  },
  health: {
    title: "Health",
    description:
      "Review reliability, queue depth, and workspace service quality.",
    icon: HeartPulse,
    metric: "99.98%",
    status: "Operational",
  },
  integrations: {
    title: "Integrations",
    description: "Connect CRM, warehouse, enrichment, and messaging systems.",
    icon: Plug,
    metric: "9 connected",
    status: "Synced",
  },
  legal: {
    title: "Legal",
    description: "Review policy, compliance, and customer agreement surfaces.",
    icon: Lock,
    metric: "4 policies",
    status: "Published",
  },
  notifications: {
    title: "Notifications",
    description:
      "Configure alerts for account movement and operational events.",
    icon: Bell,
    metric: "12 rules",
    status: "Enabled",
  },
  onboarding: {
    title: "Onboarding",
    description: "Guide new teams through setup, access, and first workflows.",
    icon: LifeBuoy,
    metric: "5 steps",
    status: "In progress",
  },
  runs: {
    title: "Runs",
    description:
      "Inspect recent workflow runs, outcomes, and exception queues.",
    icon: Activity,
    metric: "128 runs",
    status: "Processing",
  },
  sources: {
    title: "Accounts",
    description:
      "Control account inputs, source freshness, and enrichment readiness.",
    icon: Building2,
    metric: "184 accounts",
    status: "Fresh",
  },
  workflows: {
    title: "Workflows",
    description: "Design and monitor operational workflows for revenue teams.",
    icon: Workflow,
    metric: "37 active",
    status: "Running",
  },
} as const;

export type BusinessSectionKey = keyof typeof sectionDetails;

const routePathByKey = Object.fromEntries(
  TEMPLATE_ROUTE_ITEMS.map((item) => [item.key, item.path]),
) as Record<TemplateRouteKey, string>;

export function BusinessDashboardRoute() {
  return (
    <BusinessAppShell>
      <BusinessPageRoot>
        <Page.Header
          title="Revenue workspace"
          description="A plain Saas UI business app with live Convex/Confect data boundaries."
          actions={
            <HStack gap="2">
              <Button aria-label="Open notifications" variant="ghost">
                <Icon as={Bell} boxSize="4" />
              </Button>
              <Button variant="solid">
                <Icon as={Workflow} boxSize="4" />
                New workflow
              </Button>
            </HStack>
          }
        />
        <Page.Body px={{ base: "4", md: "6" }} pb="8">
          <Stack gap="6">
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="4">
              {metrics.map((metric) => (
                <Card.Root key={metric.label} borderRadius="md">
                  <Card.Body gap="3">
                    <Text color="gray.600" fontSize="sm" fontWeight="medium">
                      {metric.label}
                    </Text>
                    <Heading size="2xl">{metric.value}</Heading>
                    <Badge alignSelf="flex-start" colorPalette="green">
                      {metric.delta}
                    </Badge>
                  </Card.Body>
                </Card.Root>
              ))}
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, xl: 3 }} gap="4">
              <Card.Root borderRadius="md" gridColumn={{ xl: "span 2" }}>
                <Card.Header>
                  <Flex
                    align="center"
                    direction={{ base: "column", md: "row" }}
                    gap="3"
                    justify="space-between"
                  >
                    <Box>
                      <Heading size="md">Priority accounts</Heading>
                      <Text color="gray.600" fontSize="sm">
                        The accounts that need attention this week.
                      </Text>
                    </Box>
                    <HStack
                      bg="white"
                      borderColor="gray.200"
                      borderRadius="md"
                      borderWidth="1px"
                      gap="2"
                      px="3"
                      py="2"
                      w={{ base: "100%", md: "280px" }}
                    >
                      <Icon as={Search} boxSize="4" color="gray.500" />
                      <Input
                        aria-label="Search accounts"
                        borderWidth="0"
                        placeholder="Search accounts"
                        px="0"
                      />
                    </HStack>
                  </Flex>
                </Card.Header>
                <Card.Body pt="0">
                  <Box
                    aria-label="Priority accounts table"
                    overflowX="auto"
                    tabIndex={0}
                  >
                    <Table.Root minW="680px">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Account</Table.ColumnHeader>
                          <Table.ColumnHeader>Owner</Table.ColumnHeader>
                          <Table.ColumnHeader>Stage</Table.ColumnHeader>
                          <Table.ColumnHeader>Health</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {accounts.map((account) => (
                          <Table.Row key={account.name}>
                            <Table.Cell fontWeight="medium">
                              {account.name}
                            </Table.Cell>
                            <Table.Cell>{account.owner}</Table.Cell>
                            <Table.Cell>{account.stage}</Table.Cell>
                            <Table.Cell>
                              <Badge
                                colorPalette={
                                  account.health === "Strong"
                                    ? "green"
                                    : "yellow"
                                }
                              >
                                {account.health}
                              </Badge>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Card.Body>
              </Card.Root>

              <Card.Root borderRadius="md">
                <Card.Header>
                  <Heading size="md">Today</Heading>
                  <Text color="gray.600" fontSize="sm">
                    Focused work queued from the workspace.
                  </Text>
                </Card.Header>
                <Card.Body>
                  <Stack gap="4">
                    {tasks.map((task) => (
                      <HStack key={task} align="flex-start" gap="3">
                        <Icon
                          as={CheckCircle2}
                          boxSize="5"
                          color="green.500"
                          mt="0.5"
                        />
                        <Text>{task}</Text>
                      </HStack>
                    ))}
                  </Stack>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, xl: 3 }} gap="4">
              <Box gridColumn={{ xl: "span 2" }}>
                <LiveWorkflowRunsPanel />
              </Box>
              <Card.Root borderRadius="md">
                <Card.Header>
                  <Heading size="md">Golden path</Heading>
                  <Text color="gray.600" fontSize="sm">
                    The starter demonstrates the intended frontend stack without
                    installing extra state libraries by default.
                  </Text>
                </Card.Header>
                <Card.Body>
                  <Stack gap="3">
                    {goldenPath.map((item) => (
                      <HStack key={item} align="flex-start" gap="3">
                        <Icon
                          as={CheckCircle2}
                          boxSize="5"
                          color="green.500"
                          mt="0.5"
                        />
                        <Text fontSize="sm">{item}</Text>
                      </HStack>
                    ))}
                  </Stack>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>
          </Stack>
        </Page.Body>
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}

export function BusinessSettingsRoute() {
  return (
    <BusinessAppShell activePath="/settings">
      <BusinessPageRoot>
        <Page.Header
          title="Settings"
          description="Workspace controls."
          actions={
            <HStack justify="flex-end">
              <Button variant="solid">Save changes</Button>
            </HStack>
          }
        />
        <Page.Body px={{ base: "4", md: "6" }} pb="8">
          <SimpleGrid columns={{ base: 1, xl: 3 }} gap="4">
            <Card.Root borderRadius="md" gridColumn={{ xl: "span 2" }}>
              <Card.Header>
                <Heading size="md">Workspace profile</Heading>
                <Text color="gray.600" fontSize="sm">
                  Basic workspace details used across the application shell.
                </Text>
              </Card.Header>
              <Card.Body>
                <Stack gap="4">
                  <SettingsField
                    label="Workspace name"
                    value="Maestro Growth Workspace"
                  />
                  <SettingsField
                    label="Primary domain"
                    value="maestrogtm.com"
                  />
                  <SettingsField label="Default owner" value="RevOps team" />
                </Stack>
              </Card.Body>
            </Card.Root>

            <Card.Root borderRadius="md">
              <Card.Header>
                <Heading size="md">Access</Heading>
                <Text color="gray.600" fontSize="sm">
                  Starter roles for the business app shell.
                </Text>
              </Card.Header>
              <Card.Body>
                <Stack gap="3">
                  {["Admin", "Operator", "Viewer"].map((role) => (
                    <Flex key={role} align="center" justify="space-between">
                      <Text fontWeight="medium">{role}</Text>
                      <Badge colorPalette="blue">Enabled</Badge>
                    </Flex>
                  ))}
                </Stack>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>
        </Page.Body>
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}

export function BusinessSectionRoute({
  section,
}: {
  readonly section: BusinessSectionKey;
}) {
  const details = sectionDetails[section];
  const IconComponent = details.icon;
  const activePath = routePathByKey[section];

  return (
    <BusinessAppShell activePath={activePath}>
      <BusinessPageRoot>
        <Page.Header
          title={details.title}
          description={details.description}
          actions={
            <HStack justify="flex-end">
              <Button variant="solid">
                <Icon as={IconComponent} boxSize="4" />
                Create
              </Button>
            </HStack>
          }
        />
        <Page.Body px={{ base: "4", md: "6" }} pb="8">
          <SimpleGrid columns={{ base: 1, xl: 3 }} gap="4">
            <Card.Root borderRadius="md">
              <Card.Body gap="3">
                <Flex
                  align="center"
                  bg="gray.100"
                  borderRadius="md"
                  color="gray.800"
                  h="10"
                  justify="center"
                  w="10"
                >
                  <Icon as={IconComponent} boxSize="5" />
                </Flex>
                <Text color="gray.600" fontSize="sm" fontWeight="medium">
                  Current state
                </Text>
                <Heading size="xl">{details.metric}</Heading>
                <Badge alignSelf="flex-start" colorPalette="green">
                  {details.status}
                </Badge>
              </Card.Body>
            </Card.Root>

            <Card.Root borderRadius="md" gridColumn={{ xl: "span 2" }}>
              <Card.Header>
                <Heading size="md">Operating queue</Heading>
                <Text color="gray.600" fontSize="sm">
                  Starter business-app states for this route. Replace these rows
                  with the first client-specific workflow or data model.
                </Text>
              </Card.Header>
              <Card.Body>
                <Stack gap="4">
                  {[
                    "Review ownership and priority",
                    "Confirm automation readiness",
                    "Publish the next workspace update",
                  ].map((item) => (
                    <Flex
                      key={item}
                      align="center"
                      borderColor="gray.200"
                      borderRadius="md"
                      borderWidth="1px"
                      justify="space-between"
                      p="3"
                    >
                      <HStack gap="3">
                        <Icon as={CheckCircle2} boxSize="5" color="green.500" />
                        <Text fontWeight="medium">{item}</Text>
                      </HStack>
                      <Badge colorPalette="blue">Open</Badge>
                    </Flex>
                  ))}
                </Stack>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>
        </Page.Body>
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}

export function BusinessDataLifecycleRoute() {
  return (
    <BusinessAppShell activePath="/data-lifecycle">
      <BusinessPageRoot>
        <Page.Header
          title="Data lifecycle"
          description="A visible Confect query and mutation slice with fake-safe local behavior."
          actions={
            <HStack justify="flex-end">
              <Badge colorPalette="blue">Confect-backed</Badge>
            </HStack>
          }
        />
        <Page.Body px={{ base: "4", md: "6" }} pb="8">
          <DataLifecycleSurface />
        </Page.Body>
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}

function BusinessAppShell({
  activePath = "/",
  children,
}: {
  readonly activePath?: string;
  readonly children: ReactNode;
}) {
  return (
    <Flex minH="100vh" bg="gray.50" direction={{ base: "column", lg: "row" }}>
      <Box
        bg="white"
        borderBottomColor="gray.200"
        borderBottomWidth="1px"
        display={{ base: "block", lg: "none" }}
      >
        <HStack justify="space-between" px="4" py="3">
          <BrandMark />
          <Badge colorPalette="gray">Workspace</Badge>
        </HStack>
        <HStack
          as="nav"
          aria-label="Primary"
          gap="2"
          overflowX="auto"
          px="4"
          pb="3"
          tabIndex={0}
        >
          {TEMPLATE_NAV_CATEGORIES.flatMap((category) => category.items).map(
            (item) => (
              <BusinessNavLink
                isActive={item.path === activePath}
                key={item.key}
                layout="mobile"
                routeKey={item.key}
                to={item.path}
              >
                {item.label}
              </BusinessNavLink>
            ),
          )}
        </HStack>
      </Box>
      <Box
        as="aside"
        bg="white"
        borderRightColor="gray.200"
        borderRightWidth="1px"
        display={{ base: "none", lg: "block" }}
        flex="0 0 272px"
        minH="100vh"
        overflowY="auto"
        px="4"
        py="5"
      >
        <Stack gap="5">
          <BrandMark />
          <Separator />
          <Stack as="nav" aria-label="Primary" gap="4">
            {TEMPLATE_NAV_CATEGORIES.map((category) => (
              <Stack gap="1" key={category.label}>
                <Text
                  color="gray.500"
                  fontSize="xs"
                  fontWeight="semibold"
                  px="3"
                  textTransform="uppercase"
                >
                  {category.label}
                </Text>
                {category.items.map((item) => (
                  <BusinessNavLink
                    isActive={item.path === activePath}
                    key={item.key}
                    layout="desktop"
                    routeKey={item.key}
                    to={item.path}
                  >
                    {item.label}
                  </BusinessNavLink>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Box>
      <Box flex="1" minW="0">
        {children}
      </Box>
    </Flex>
  );
}

function BusinessPageRoot({ children }: { readonly children: ReactNode }) {
  return (
    <Page.Root
      bg="gray.50"
      className="template-shell-content"
      id="template-main-content"
      minH="100vh"
      tabIndex={-1}
    >
      {children}
    </Page.Root>
  );
}

function BusinessNavLink({
  children,
  isActive,
  layout,
  routeKey,
  to,
}: {
  readonly children: ReactNode;
  readonly isActive: boolean;
  readonly layout: "desktop" | "mobile";
  readonly routeKey: TemplateRouteKey;
  readonly to: string;
}) {
  const IconComponent = navIconByKey[routeKey];

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className="template-sidebar-row"
      style={layout === "mobile" ? { width: "auto" } : undefined}
      to={to}
    >
      <HStack
        bg={isActive ? "gray.100" : "transparent"}
        borderRadius="md"
        color={isActive ? "black" : "gray.700"}
        flex={layout === "mobile" ? "0 0 auto" : undefined}
        gap="3"
        minH="9"
        px="3"
        py="2"
      >
        <Icon as={IconComponent} boxSize="4" />
        <Text
          className="template-sidebar-label"
          fontSize="sm"
          fontWeight="medium"
          whiteSpace="nowrap"
        >
          {children}
        </Text>
      </HStack>
    </Link>
  );
}

function BrandMark() {
  return (
    <HStack gap="3">
      <Flex
        align="center"
        bg="black"
        borderRadius="md"
        color="white"
        h="9"
        justify="center"
        w="9"
      >
        <Icon as={Activity} boxSize="5" />
      </Flex>
      <Box>
        <Text fontWeight="bold">Maestro</Text>
        <Text color="gray.500" fontSize="xs">
          Business app
        </Text>
      </Box>
    </HStack>
  );
}

function SettingsField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Box>
      <Text color="gray.600" fontSize="sm" fontWeight="medium" mb="1.5">
        {label}
      </Text>
      <Input defaultValue={value} />
    </Box>
  );
}
