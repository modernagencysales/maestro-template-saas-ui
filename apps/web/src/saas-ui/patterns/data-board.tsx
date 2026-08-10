import type { DragEvent } from "react";
import { Button, Card, Grid, Heading, Stack, Text } from "@saas-ui/react";
import { PageStateView } from "./page-states";

// Derived from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 packages/kanban/src.
export interface BoardItem {
  readonly id: string;
  readonly title: string;
  readonly columnId: string;
}
export interface BoardColumn {
  readonly id: string;
  readonly title: string;
}

export const moveBoardItem = (
  items: readonly BoardItem[],
  id: string,
  columnId: string,
): BoardItem[] =>
  items.map((item) => (item.id === id ? { ...item, columnId } : item));

export function DataBoard({
  columns,
  items,
  onMove,
}: {
  readonly columns: readonly BoardColumn[];
  readonly items: readonly BoardItem[];
  readonly onMove: (id: string, columnId: string) => void;
}) {
  if (items.length === 0)
    return (
      <PageStateView
        description="Connect a source or create the first owned item."
        state="empty"
        title="No board items yet"
      />
    );
  return (
    <Grid
      gap="4"
      overflowX="auto"
      templateColumns={`repeat(${columns.length}, minmax(16rem, 1fr))`}
    >
      {columns.map((column, columnIndex) => (
        <Stack
          aria-label={column.title}
          as="section"
          gap="3"
          key={column.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            const itemId = event.dataTransfer.getData("text/plain");
            if (itemId) onMove(itemId, column.id);
          }}
        >
          <Heading size="sm">{column.title}</Heading>
          {items
            .filter((item) => item.columnId === column.id)
            .map((item) => (
              <Card.Root
                draggable
                key={item.id}
                onDragStart={(event: DragEvent<HTMLDivElement>) =>
                  event.dataTransfer.setData("text/plain", item.id)
                }
              >
                <Card.Body gap="2">
                  <Text>{item.title}</Text>
                  <Stack direction="row">
                    <Button
                      aria-label={`Move ${item.title} to previous column`}
                      disabled={columnIndex === 0}
                      onClick={() =>
                        onMove(
                          item.id,
                          columns[columnIndex - 1]?.id ?? column.id,
                        )
                      }
                      size="xs"
                      variant="ghost"
                    >
                      Move back
                    </Button>
                    <Button
                      aria-label={`Move ${item.title} to next column`}
                      disabled={columnIndex === columns.length - 1}
                      onClick={() =>
                        onMove(
                          item.id,
                          columns[columnIndex + 1]?.id ?? column.id,
                        )
                      }
                      size="xs"
                      variant="ghost"
                    >
                      Move forward
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            ))}
        </Stack>
      ))}
    </Grid>
  );
}
