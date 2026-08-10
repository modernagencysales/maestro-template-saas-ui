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
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
} from "lucide-react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import { useTemplateQuery } from "../../adapters/confect-state";
import { isConvexConfigured } from "../../env";
import { StateNotice } from "../../saas-ui/patterns";
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
            <Text color="fg.muted" fontSize="sm">
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

const liveRunsBadgeByKind = {
  connecting: { label: "Connecting" },
  unconfigured: { label: "Fake-safe" },
  unseeded: { label: "Setup required" },
  unavailable: { label: "Unavailable" },
} as const;

function LiveRunsStatusBadge({ view }: { readonly view: LiveRunsView }) {
  if (view.kind === "ready") {
    return <Badge variant="outline">{view.runCount} live rows</Badge>;
  }

  const badge = liveRunsBadgeByKind[view.kind];
  return <Badge variant="outline">{badge.label}</Badge>;
}

const liveRunsNoticeByKind = {
  connecting: {
    icon: Activity,
    title: "Connecting to Convex",
    state: "loading",
    body: <>The query is waiting for the live subscription to resolve.</>,
  },
  unconfigured: {
    icon: DatabaseZap,
    title: "No Convex deployment configured",
    state: "neutral",
    body: (
      <>
        Set <code>VITE_CONVEX_URL</code> to connect this card to the seeded demo
        workspace. Until then, the app stays fake-safe for local development.
      </>
    ),
  },
  unseeded: {
    icon: AlertTriangle,
    title: "Demo workspace not seeded",
    state: "warning",
    body: (
      <>
        Run <code>convex run demo/showcase:seed</code> after deploying the
        backend.
      </>
    ),
  },
} as const;

function LiveRunsBody({ view }: { readonly view: LiveRunsView }) {
  if (view.kind === "ready") {
    return <ReadyLiveRuns view={view} />;
  }

  const notice =
    view.kind === "unavailable"
      ? {
          icon: AlertTriangle,
          title: "Live backend unavailable",
          state: "failure" as const,
          body: view.detail,
        }
      : liveRunsNoticeByKind[view.kind];

  return (
    <StateNotice icon={notice.icon} state={notice.state} title={notice.title}>
      {notice.body}
    </StateNotice>
  );
}

function ReadyLiveRuns({
  view,
}: {
  readonly view: Extract<LiveRunsView, { readonly kind: "ready" }>;
}) {
  if (view.rows.length === 0) {
    return (
      <StateNotice
        icon={CheckCircle2}
        state="success"
        title="Connected with no runs"
      >
        Workspace <strong>{view.workspaceName}</strong> is available, but no
        workflow runs have been recorded yet.
      </StateNotice>
    );
  }

  return (
    <Stack gap="4">
      <HStack align="flex-start" gap="3">
        <Icon as={CheckCircle2} boxSize="5" mt="0.5" />
        <Text color="fg.muted" fontSize="sm">
          Streaming from workspace <strong>{view.workspaceName}</strong>. These
          rows come from the live backend, not bundled fixture data.
        </Text>
      </HStack>
      <Box aria-label="Live workflow runs table" overflowX="auto" tabIndex={0}>
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
                <Table.Cell fontWeight="medium">{row.workflowId}</Table.Cell>
                <Table.Cell>v{row.workflowVersion}</Table.Cell>
                <Table.Cell>
                  <Badge variant="outline">{row.status}</Badge>
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
