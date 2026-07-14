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

export type ClientsScreenState =
  | { readonly status: "loading" }
  | { readonly status: "empty" }
  | { readonly status: "typed_failure" }
  | { readonly status: "transport_failure" }
  | {
      readonly status: "ready";
      readonly clients: readonly ClientRow[];
    };

export type ClientRow = {
  readonly key: string;
  readonly name: string;
  readonly health: string;
  readonly freshness: string;
  readonly connections: number;
};

export function ClientsScreen({
  state,
}: {
  readonly state: ClientsScreenState;
}) {
  return (
    <>
      <Page.Header
        title="Clients"
        description="Client Brains, freshness, and recent activity in one focused workspace."
      />
      <Page.Body px={{ base: "4", md: "6" }} pb="8">
        <ClientsStateCard state={state} />
      </Page.Body>
    </>
  );
}

function ClientsStateCard({ state }: { readonly state: ClientsScreenState }) {
  if (state.status === "loading") {
    return (
      <StateCard
        title="Loading client Brains"
        description="Preparing the client list."
      />
    );
  }

  if (state.status === "empty") {
    return (
      <StateCard
        title="No client Brains yet"
        description="Create the first client Brain to start a Brief."
      />
    );
  }

  if (state.status === "typed_failure") {
    return (
      <StateCard
        title="Client list unavailable"
        description="The request was rejected by a typed product contract."
        tone="yellow"
      />
    );
  }

  if (state.status === "transport_failure") {
    return (
      <StateCard
        title="Connection interrupted"
        description="Check connectivity and retry the client list."
        tone="red"
      />
    );
  }

  return (
    <Card.Root borderRadius="md">
      <Card.Header>
        <Flex align="center" justify="space-between" gap="3">
          <Box>
            <Heading size="md">Client Brains</Heading>
            <Text color="gray.600" fontSize="sm">
              Ready client context with freshness and connection counts.
            </Text>
          </Box>
          <Badge colorPalette="green">Ready</Badge>
        </Flex>
      </Card.Header>
      <Card.Body pt="0">
        <Box aria-label="Clients table" overflowX="auto" tabIndex={0}>
          <Table.Root minW="640px">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Client</Table.ColumnHeader>
                <Table.ColumnHeader>Health</Table.ColumnHeader>
                <Table.ColumnHeader>Freshness</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  Connections
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.clients.map((client) => (
                <Table.Row key={client.key}>
                  <Table.Cell fontWeight="medium">{client.name}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette="green">{client.health}</Badge>
                  </Table.Cell>
                  <Table.Cell>{client.freshness}</Table.Cell>
                  <Table.Cell textAlign="end">{client.connections}</Table.Cell>
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
