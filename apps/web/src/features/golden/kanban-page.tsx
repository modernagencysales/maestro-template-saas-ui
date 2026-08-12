import { Badge, Card, Heading, SimpleGrid, Stack, Text } from "@saas-ui/react";

import { goldenFixtures } from "./fixtures";

export function GoldenKanbanPage() {
  const columns = ["Backlog", "In progress", "Done"] as const;
  return (
    <Stack gap="6" p={{ base: "5", md: "8" }}>
      <Heading size="lg">Kanban archetype</Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        {columns.map((column, index) => (
          <Stack key={column} gap="3" minH="220px" data-kanban-column={column}>
            <Heading size="sm">{column}</Heading>
            <Card.Root draggable={index === 0} variant="subtle">
              <Card.Body>
                <Stack gap="2">
                  <Text>
                    {
                      goldenFixtures.contacts[
                        index % goldenFixtures.contacts.length
                      ]?.name
                    }
                  </Text>
                  <Badge width="fit-content">{column}</Badge>
                </Stack>
              </Card.Body>
            </Card.Root>
          </Stack>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
