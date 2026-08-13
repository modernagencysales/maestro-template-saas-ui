import { createFileRoute } from "@tanstack/react-router";
import { Box, Button, HStack, Page, Stack } from "@saas-ui/react";
import { Kanban } from "@saas-ui-pro/kanban";

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
            defaultItems={{ todo: ["task-1"], done: ["task-3"] }}
          >
            <Box minH="2" />
          </Kanban>
        </Stack>
      </Page.Body>
    </Page.Root>
  );
}
