import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
} from "@saas-ui/react";
import * as Sui from "@saas-ui/react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
} from "lucide-react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import { useTemplateQuery } from "../../adapters/confect-state";
import { isConvexConfigured } from "../../env";
import { StatusNotice } from "../../saas-ui/status-notice";
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
  connecting: { label: "Connecting", tone: "blue" },
  unconfigured: { label: "Fake-safe", tone: "gray" },
  unseeded: { label: "Seed required", tone: "yellow" },
  unavailable: { label: "Unavailable", tone: "red" },
} as const;

function LiveRunsStatusBadge({ view }: { readonly view: LiveRunsView }) {
  if (view.kind === "ready") {
    return <Badge colorPalette="green">{view.runCount} live rows</Badge>;
  }

  const badge = liveRunsBadgeByKind[view.kind];
  return <Badge colorPalette={badge.tone}>{badge.label}</Badge>;
}

const liveRunsNoticeByKind = {
  connecting: {
    icon: Activity,
    title: "Connecting to Convex",
    tone: "blue",
    body: <>The query is waiting for the live subscription to resolve.</>,
  },
  unconfigured: {
    icon: DatabaseZap,
    title: "No Convex deployment configured",
    tone: "gray",
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
    tone: "yellow",
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
          tone: "red" as const,
          body: view.detail,
        }
      : liveRunsNoticeByKind[view.kind];

  return (
    <StatusNotice icon={notice.icon} title={notice.title} tone={notice.tone}>
      {notice.body}
    </StatusNotice>
  );
}

function ReadyLiveRuns({
  view,
}: {
  readonly view: Extract<LiveRunsView, { readonly kind: "ready" }>;
}) {
  if (view.rows.length === 0) {
    return (
      <StatusNotice
        icon={CheckCircle2}
        title="Connected with no runs"
        tone="green"
      >
        Workspace <strong>{view.workspaceName}</strong> is available, but no
        workflow runs have been recorded yet.
      </StatusNotice>
    );
  }

  return (
    <Stack gap="4">
      <HStack align="flex-start" gap="3">
        <Icon as={CheckCircle2} boxSize="5" color="fg.success" mt="0.5" />
        <Text color="fg" fontSize="sm">
          Streaming from workspace <strong>{view.workspaceName}</strong>. These
          rows come from the live backend, not bundled fixture data.
        </Text>
      </HStack>
      <Box aria-label="Live workflow runs table" overflowX="auto" tabIndex={0}>
        <Sui.Table.Root minW="620px">
          <Sui.Table.Header>
            <Sui.Table.Row>
              <Sui.Table.ColumnHeader>Workflow</Sui.Table.ColumnHeader>
              <Sui.Table.ColumnHeader>Version</Sui.Table.ColumnHeader>
              <Sui.Table.ColumnHeader>Status</Sui.Table.ColumnHeader>
              <Sui.Table.ColumnHeader>Started</Sui.Table.ColumnHeader>
            </Sui.Table.Row>
          </Sui.Table.Header>
          <Sui.Table.Body>
            {view.rows.map((row) => (
              <Sui.Table.Row key={row.key}>
                <Sui.Table.Cell fontWeight="medium">
                  {row.workflowId}
                </Sui.Table.Cell>
                <Sui.Table.Cell>v{row.workflowVersion}</Sui.Table.Cell>
                <Sui.Table.Cell>
                  <Badge colorPalette={statusTone(row.status)}>
                    {row.status}
                  </Badge>
                </Sui.Table.Cell>
                <Sui.Table.Cell>{row.startedAtLabel}</Sui.Table.Cell>
              </Sui.Table.Row>
            ))}
          </Sui.Table.Body>
        </Sui.Table.Root>
      </Box>
    </Stack>
  );
}

const workflowStatusToneByStatus: Partial<
  Record<string, "blue" | "green" | "red" | "yellow">
> = {
  completed: "green",
  running: "blue",
  queued: "yellow",
  failed: "red",
};

function statusTone(
  status: string,
): "blue" | "green" | "gray" | "red" | "yellow" {
  return workflowStatusToneByStatus[status] ?? "gray";
}
