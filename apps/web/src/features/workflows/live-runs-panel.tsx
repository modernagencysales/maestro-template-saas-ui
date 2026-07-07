import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Table,
  Text,
} from "@saas-ui/react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
} from "lucide-react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import { useTemplateQuery } from "../../adapters/confect-state";
import { isConvexConfigured } from "../../env";
import { presentLiveRuns, type LiveRunsView } from "./live-runs-presenter";

/**
 * Live workflow runs from the deployed Convex backend. This is the dashboard
 * card that proves the template can render a real Confect public query through
 * the normalized frontend state adapter.
 */
export function LiveWorkflowRunsPanel() {
  const state = useTemplateQuery(
    templateConfectRefs.public.demo.showcase.overview,
    isConvexConfigured() ? {} : "skip",
  );
  const view = presentLiveRuns(state);

  return (
    <Card.Root
      aria-label="Live workflow runs"
      as="section"
      borderRadius="md"
      h="100%"
    >
      <Card.Header>
        <Flex
          align={{ base: "flex-start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap="3"
          justify="space-between"
        >
          <Box>
            <Heading size="md">Live workflow runs</Heading>
            <Text color="gray.600" fontSize="sm">
              Convex subscription data normalized through the Confect adapter.
            </Text>
          </Box>
          <LiveRunsStatusBadge view={view} />
        </Flex>
      </Card.Header>
      <Card.Body pt="0">
        <LiveRunsBody view={view} />
      </Card.Body>
    </Card.Root>
  );
}

function LiveRunsStatusBadge({ view }: { readonly view: LiveRunsView }) {
  switch (view.kind) {
    case "ready":
      return <Badge colorPalette="green">{view.runCount} live rows</Badge>;
    case "connecting":
      return <Badge colorPalette="blue">Connecting</Badge>;
    case "unconfigured":
      return <Badge colorPalette="gray">Fake-safe</Badge>;
    case "unseeded":
      return <Badge colorPalette="yellow">Seed required</Badge>;
    case "unavailable":
      return <Badge colorPalette="red">Unavailable</Badge>;
  }
}

function LiveRunsBody({ view }: { readonly view: LiveRunsView }) {
  switch (view.kind) {
    case "unconfigured":
      return (
        <LiveRunsNotice
          icon={DatabaseZap}
          title="No Convex deployment configured"
          tone="gray"
        >
          Set <code>VITE_CONVEX_URL</code> to connect this card to the seeded
          demo workspace. Until then, the app stays fake-safe for local
          development.
        </LiveRunsNotice>
      );
    case "connecting":
      return (
        <LiveRunsNotice
          icon={Activity}
          title="Connecting to Convex"
          tone="blue"
        >
          The query is waiting for the live subscription to resolve.
        </LiveRunsNotice>
      );
    case "unavailable":
      return (
        <LiveRunsNotice
          icon={AlertTriangle}
          title="Live backend unavailable"
          tone="red"
        >
          {view.detail}
        </LiveRunsNotice>
      );
    case "unseeded":
      return (
        <LiveRunsNotice
          icon={AlertTriangle}
          title="Demo workspace not seeded"
          tone="yellow"
        >
          Run <code>convex run demo/showcase:seed</code> after deploying the
          backend.
        </LiveRunsNotice>
      );
    case "ready":
      if (view.rows.length === 0) {
        return (
          <LiveRunsNotice
            icon={CheckCircle2}
            title="Connected with no runs"
            tone="green"
          >
            Workspace <strong>{view.workspaceName}</strong> is available, but no
            workflow runs have been recorded yet.
          </LiveRunsNotice>
        );
      }

      return (
        <Stack gap="4">
          <HStack align="flex-start" gap="3">
            <Icon as={CheckCircle2} boxSize="5" color="green.500" mt="0.5" />
            <Text color="gray.700" fontSize="sm">
              Streaming from workspace <strong>{view.workspaceName}</strong>.
              These rows come from the live backend, not bundled fixture data.
            </Text>
          </HStack>
          <Box
            aria-label="Live workflow runs table"
            overflowX="auto"
            tabIndex={0}
          >
            <Table.Root minW="620px">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Workflow</Table.ColumnHeader>
                  <Table.ColumnHeader>Version</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>Started</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {view.rows.map((row) => (
                  <Table.Row key={row.key}>
                    <Table.Cell fontWeight="medium">
                      {row.workflowId}
                    </Table.Cell>
                    <Table.Cell>v{row.workflowVersion}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={statusTone(row.status)}>
                        {row.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{row.startedAtLabel}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Stack>
      );
  }
}

function LiveRunsNotice({
  children,
  icon,
  title,
  tone,
}: {
  readonly children: ReactNode;
  readonly icon: typeof Activity;
  readonly title: string;
  readonly tone: "blue" | "gray" | "green" | "red" | "yellow";
}) {
  return (
    <HStack
      align="flex-start"
      bg={`${tone}.50`}
      borderColor={`${tone}.200`}
      borderRadius="md"
      borderWidth="1px"
      gap="3"
      p="4"
    >
      <Icon as={icon} boxSize="5" color={`${tone}.600`} mt="0.5" />
      <Box>
        <Text fontWeight="semibold">{title}</Text>
        <Text color="gray.700" fontSize="sm" mt="1">
          {children}
        </Text>
      </Box>
    </HStack>
  );
}

function statusTone(
  status: string,
): "blue" | "green" | "gray" | "red" | "yellow" {
  switch (status) {
    case "completed":
      return "green";
    case "running":
      return "blue";
    case "queued":
      return "yellow";
    case "failed":
      return "red";
    default:
      return "gray";
  }
}
