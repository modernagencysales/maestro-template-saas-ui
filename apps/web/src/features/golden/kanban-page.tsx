import {
  Badge,
  Button,
  Card,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from "@saas-ui/react";
import * as React from "react";

import { goldenFixtures } from "./fixtures";

const columns = ["Backlog", "In progress", "Done"] as const;
type Column = (typeof columns)[number];
type CardFixture = { id: string; name: string; column: Column };

export function GoldenKanbanPage() {
  const [cards, setCards] = React.useState<CardFixture[]>(
    goldenFixtures.kanban.map((card) => ({ ...card })),
  );
  const [draggedCard, setDraggedCard] = React.useState<string | null>(null);
  const moveCard = (id: string, column: Column) => {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, column } : card)),
    );
  };

  return (
    <Stack gap="6" p={{ base: "5", md: "8" }}>
      <Heading size="lg">Kanban archetype</Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        {columns.map((column) => (
          <Stack
            key={column}
            gap="3"
            minH="220px"
            role="region"
            aria-label={column}
            data-kanban-column={column}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedCard) moveCard(draggedCard, column);
              setDraggedCard(null);
            }}
          >
            <Heading size="sm">{column}</Heading>
            {cards
              .filter((card) => card.column === column)
              .map((card) => {
                const nextColumn =
                  columns[(columns.indexOf(column) + 1) % columns.length];
                return (
                  <Card.Root
                    key={card.id}
                    draggable
                    variant="subtle"
                    onDragStart={() => setDraggedCard(card.id)}
                  >
                    <Card.Body>
                      <Stack gap="2">
                        <Text>{card.name}</Text>
                        <Badge width="fit-content">{column}</Badge>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => moveCard(card.id, nextColumn)}
                        >
                          Move {card.name} to {nextColumn}
                        </Button>
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                );
              })}
          </Stack>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
