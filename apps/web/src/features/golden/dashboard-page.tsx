import { Card, Heading, SimpleGrid, Stack, Text } from "@saas-ui/react";

import { goldenFixtures } from "./fixtures";

export function DashboardPage() {
  return (
    <Stack gap="8" p={{ base: "5", md: "8" }}>
      <Stack gap="1">
        <Heading size="xl">
          Good morning, {goldenFixtures.currentUser.name}
        </Heading>
        <Text color="fg.muted">
          A neutral dashboard for the upstream-derived SaaS chassis.
        </Text>
      </Stack>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        {[
          ["Contacts", goldenFixtures.contacts.length.toString()],
          ["Workspace", goldenFixtures.currentWorkspace.name],
          ["Open tasks", "12"],
        ].map(([label, value]) => (
          <Card.Root key={label} variant="subtle">
            <Card.Body>
              <Text color="fg.muted" fontSize="sm">
                {label}
              </Text>
              <Heading size="lg">{value}</Heading>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
