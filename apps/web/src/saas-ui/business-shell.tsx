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
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  FileCode2,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Accounts", to: "/sources", icon: Building2 },
  { label: "Workflows", to: "/workflows", icon: Workflow },
  { label: "Documents", to: "/documents", icon: FileText },
  { label: "Team", to: "/agents", icon: Users },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

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
    description:
      "Organize shared knowledge without the old document demo shell.",
    icon: FileText,
    metric: "42 notes",
    status: "Indexed",
  },
  capabilities: {
    title: "Capabilities",
    description:
      "Catalog approved enrichment, routing, and execution capabilities.",
    icon: ShieldCheck,
    metric: "18 approved",
    status: "Reviewed",
  },
  dataLifecycle: {
    title: "Data lifecycle",
    description: "Monitor retention, sync status, and governed data movement.",
    icon: Database,
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

export function BusinessDashboardRoute() {
  return (
    <BusinessAppShell>
      <Page.Root minH="100vh" bg="gray.50">
        <Page.Header
          title="Revenue workspace"
          description="Clean revenue operations."
          actions={
            <HStack gap="2">
              <Button variant="ghost">
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
                  <Box overflowX="auto">
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
          </Stack>
        </Page.Body>
      </Page.Root>
    </BusinessAppShell>
  );
}

export function BusinessSettingsRoute() {
  return (
    <BusinessAppShell activePath="/settings">
      <Page.Root minH="100vh" bg="gray.50">
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
      </Page.Root>
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
  const activePath = sectionToPath(section);

  return (
    <BusinessAppShell activePath={activePath}>
      <Page.Root minH="100vh" bg="gray.50">
        <Page.Header
          title={details.title}
          description="Manage workspace operations."
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
                  A simple Saas UI business-app surface replacing the old
                  reference document route.
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
      </Page.Root>
    </BusinessAppShell>
  );
}

function BusinessAppShell({
  activePath = "/",
  children,
}: {
  readonly activePath?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Flex minH="100vh" bg="gray.50">
      <Box
        as="aside"
        bg="white"
        borderRightColor="gray.200"
        borderRightWidth="1px"
        display={{ base: "none", lg: "block" }}
        flex="0 0 256px"
        minH="100vh"
        px="4"
        py="5"
      >
        <Stack gap="5">
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
          <Separator />
          <Stack as="nav" gap="1">
            {navItems.map((item) => {
              const isActive = item.to === activePath;
              return (
                <Link key={item.label} to={item.to}>
                  <HStack
                    bg={isActive ? "gray.100" : "transparent"}
                    borderRadius="md"
                    color={isActive ? "black" : "gray.700"}
                    gap="3"
                    px="3"
                    py="2"
                  >
                    <Icon as={item.icon} boxSize="4" />
                    <Text fontSize="sm" fontWeight="medium">
                      {item.label}
                    </Text>
                  </HStack>
                </Link>
              );
            })}
          </Stack>
        </Stack>
      </Box>
      <Box flex="1" minW="0">
        {children}
      </Box>
    </Flex>
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

function sectionToPath(section: BusinessSectionKey) {
  switch (section) {
    case "admin":
      return "/admin";
    case "agents":
      return "/agents";
    case "analytics":
      return "/analytics";
    case "api":
      return "/api";
    case "billing":
      return "/billing";
    case "brain":
      return "/brain";
    case "capabilities":
      return "/capabilities";
    case "dataLifecycle":
      return "/data-lifecycle";
    case "dataMap":
      return "/data-map";
    case "documents":
      return "/documents";
    case "health":
      return "/health";
    case "integrations":
      return "/integrations";
    case "legal":
      return "/legal";
    case "notifications":
      return "/notifications";
    case "onboarding":
      return "/onboarding";
    case "runs":
      return "/runs";
    case "sources":
      return "/sources";
    case "workflows":
      return "/workflows";
  }
}
