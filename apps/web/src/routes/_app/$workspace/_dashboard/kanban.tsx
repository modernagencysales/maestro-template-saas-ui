import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Box, Button, Card, HStack, Page, Stack, Text } from "@saas-ui/react";
import {
  Kanban,
  KanbanCard,
  KanbanColumn,
  KanbanColumnBody,
  KanbanColumnHeader,
  KanbanDragOverlay,
  useKanbanContext,
} from "@saas-ui-pro/kanban";

import { SortableTaskList } from "#components/sortable-task-list/sortable-task-list";
import { TaskCardWithLabels } from "#components/task-card-with-labels/task-card-with-labels";
import { TaskCardWithProperties } from "#components/task-card-with-properties/task-card-with-properties";

export const Route = createFileRoute("/_app/$workspace/_dashboard/kanban")({
  head: () => ({ meta: [{ title: "Kanban" }] }),
  component: KanbanPage,
});

const tasks = [
  {
    id: "task-1",
    title: "Import workspace sources",
    date: "Today",
    labels: ["Sources"],
    status: "todo",
  },
  {
    id: "task-2",
    title: "Review first workflow",
    date: "Tomorrow",
    labels: ["Workflow"],
    status: "in-progress",
  },
  {
    id: "task-3",
    title: "Share launch brief",
    date: "Friday",
    labels: ["Launch"],
    status: "done",
  },
];
const cardTask = {
  status: "in-progress" as const,
  priority: 2 as const,
  dueDate: "Tomorrow",
  milestone: "Launch",
  subtasks: "2 / 4",
  tags: ["ui", "react"],
  user: { name: "Alex Morgan", avatar: "", presence: "online" as const },
};

function KanbanPage() {
  return (
    <Page.Root height="100%">
      <Page.Header
        title="Kanban"
        description="Move work through a shared board."
        actions={<Button>Add task</Button>}
      />
      <Page.Body>
        <Stack gap="6">
          <SortableTaskList tasks={tasks} />
          <HStack alignItems="stretch" gap="4" flexWrap="wrap">
            <Box flex="1" minW="280px">
              <TaskCardWithLabels task={cardTask} />
            </Box>
            <Box flex="1" minW="280px">
              <TaskCardWithProperties task={cardTask} />
            </Box>
          </HStack>
          <Kanban
            aria-label="Pro Kanban board"
            defaultItems={{ todo: ["task-1", "task-2"], done: ["task-3"] }}
          >
            {({ columns, items, activeId }) => (
              <HStack
                alignItems="stretch"
                gap="4"
                flexDirection={{ base: "column", md: "row" }}
                overflowX={{ base: "visible", md: "auto" }}
              >
                {columns.map((columnId) => (
                  <KanbanBoardColumn key={columnId} id={String(columnId)}>
                    {(items[columnId] ?? []).map((itemId) => (
                      <KanbanCard
                        key={itemId}
                        id={String(itemId)}
                        data-testid={`kanban-card-${itemId}`}
                      >
                        <Card.Root minH="20" w="full">
                          <Card.Body>
                            {
                              tasks.find((task) => task.id === String(itemId))
                                ?.title
                            }
                          </Card.Body>
                        </Card.Root>
                      </KanbanCard>
                    ))}
                  </KanbanBoardColumn>
                ))}
                <KanbanDragOverlay>
                  {activeId ? <Text>{String(activeId)}</Text> : null}
                </KanbanDragOverlay>
              </HStack>
            )}
          </Kanban>
        </Stack>
      </Page.Body>
    </Page.Root>
  );
}

function KanbanBoardColumn({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { items } = useKanbanContext();
  return (
    <KanbanColumn id={id} data-testid={`kanban-column-${id}`}>
      <KanbanColumnHeader>
        {id === "todo" ? "To do" : "Done"} ({items[id]?.length ?? 0})
      </KanbanColumnHeader>
      <KanbanColumnBody>{children}</KanbanColumnBody>
    </KanbanColumn>
  );
}
