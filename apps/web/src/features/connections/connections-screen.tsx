import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  Page,
  Stack,
  Table,
  Text,
} from "@saas-ui/react";

export type ConnectionsScreenState =
  | { readonly status: "loading" }
  | { readonly status: "empty" }
  | { readonly status: "typed_failure" }
  | { readonly status: "transport_failure" }
  | {
      readonly status: "ready";
      readonly connections: readonly ConnectionRow[];
    };

export type ConnectionRow = {
  readonly key: string;
  readonly provider: string;
  readonly status: string;
  readonly scope: string;
  readonly lastSync: string;
};

export function ConnectionsScreen({
  state,
}: {
  readonly state: ConnectionsScreenState;
}) {
  return (
    <>
      <Page.Header
        title="Connections"
        description="Approved agency data connections with fake-safe local status by default."
      />
      <Page.Body px={{ base: "4", md: "6" }} pb="8">
        <ConnectionsStateCard state={state} />
      </Page.Body>
    </>
  );
}

function ConnectionsStateCard({
  state,
}: {
  readonly state: ConnectionsScreenState;
}) {
  if (state.status === "loading") {
    return (
      <StateCard
        title="Loading connections"
        description="Checking local connection state."
      />
    );
  }

  if (state.status === "empty") {
    return (
      <StateCard
        title="No connections yet"
        description="Connect Slack or another approved source when ready."
      />
    );
  }

  if (state.status === "typed_failure") {
    return (
      <StateCard
        title="Connection setup unavailable"
        description="The connection request failed a typed product contract."
        tone="yellow"
      />
    );
  }

  if (state.status === "transport_failure") {
    return (
      <StateCard
        title="Connection status interrupted"
        description="Provider status could not be reached from this session."
        tone="red"
      />
    );
  }

  return (
    <Card.Root borderRadius="md">
      <Card.Header>
        <Flex align="center" justify="space-between" gap="3">
          <Box>
            <Heading size="md">Workspace connections</Heading>
            <Text color="gray.600" fontSize="sm">
              Provider posture without marketplace or campaign surfaces.
            </Text>
          </Box>
          <Badge colorPalette="green">Ready</Badge>
        </Flex>
      </Card.Header>
      <Card.Body pt="0">
        <Box aria-label="Connections table" overflowX="auto" tabIndex={0}>
          <Table.Root minW="640px">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Provider</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Scope</Table.ColumnHeader>
                <Table.ColumnHeader>Last sync</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.connections.map((connection) => (
                <Table.Row key={connection.key}>
                  <Table.Cell fontWeight="medium">
                    {connection.provider}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette="green">{connection.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>{connection.scope}</Table.Cell>
                  <Table.Cell>{connection.lastSync}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </Card.Body>
    </Card.Root>
  );
}

function StateCard({
  description,
  title,
  tone = "blue",
}: {
  readonly description: string;
  readonly title: string;
  readonly tone?: "blue" | "red" | "yellow";
}) {
  return (
    <Card.Root borderRadius="md">
      <Card.Body>
        <Stack gap="3">
          <Badge alignSelf="flex-start" colorPalette={tone}>
            {title}
          </Badge>
          <Heading size="md">{title}</Heading>
          <Text color="gray.600">{description}</Text>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
