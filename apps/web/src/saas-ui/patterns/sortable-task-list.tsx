import { Button, HStack, Stack, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 sortable-task-list.tsx.
export interface SortableTask {
  readonly id: string;
  readonly title: string;
}
export const reorderTasks = (
  tasks: readonly SortableTask[],
  from: number,
  to: number,
): SortableTask[] => {
  const next = [...tasks];
  const [task] = next.splice(from, 1);
  if (task) next.splice(to, 0, task);
  return next;
};
export function SortableTaskList({
  onReorder,
  tasks,
}: {
  readonly onReorder: (tasks: readonly SortableTask[]) => void;
  readonly tasks: readonly SortableTask[];
}) {
  return (
    <Stack aria-label="Sortable tasks" gap="2">
      {tasks.map((task, index) => (
        <HStack borderBottomWidth="1px" key={task.id} py="2">
          <Text flex="1">{task.title}</Text>
          <Button
            aria-label={`Move ${task.title} up`}
            disabled={index === 0}
            onClick={() => onReorder(reorderTasks(tasks, index, index - 1))}
            size="xs"
            variant="ghost"
          >
            Move up
          </Button>
          <Button
            aria-label={`Move ${task.title} down`}
            disabled={index === tasks.length - 1}
            onClick={() => onReorder(reorderTasks(tasks, index, index + 1))}
            size="xs"
            variant="ghost"
          >
            Move down
          </Button>
        </HStack>
      ))}
    </Stack>
  );
}
