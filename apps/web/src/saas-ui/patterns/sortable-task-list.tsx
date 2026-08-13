import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Box, HStack, Stack, Text } from "@saas-ui/react";

// Adapted from saas-ui-pro@ac3a40c sortable-task-list.tsx.

export interface SortableTask {
  readonly id: string;
  readonly title: string;
}
export const reorderTasks = (
  tasks: readonly SortableTask[],
  from: number,
  to: number,
): SortableTask[] => arrayMove([...tasks], from, to);

export function SortableTaskList({
  onReorder,
  tasks,
}: {
  readonly onReorder: (tasks: readonly SortableTask[]) => void;
  readonly tasks: readonly SortableTask[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const finish = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = tasks.findIndex(({ id }) => id === active.id);
    const to = tasks.findIndex(({ id }) => id === over.id);
    if (from >= 0 && to >= 0) onReorder(reorderTasks(tasks, from, to));
  };
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={finish}
      sensors={sensors}
    >
      <SortableContext
        items={tasks.map(({ id }) => id)}
        strategy={verticalListSortingStrategy}
      >
        <Stack aria-label="Sortable tasks" gap="0">
          {tasks.map((task) => (
            <SortableRow key={task.id} task={task} />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ task }: { readonly task: SortableTask }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  return (
    <HStack
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      borderBottomWidth="1px"
      cursor="grab"
      opacity={isDragging ? 0.5 : 1}
      py="3"
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
          : undefined,
        transition,
      }}
    >
      <Box aria-hidden="true" color="fg.muted">
        ⋮⋮
      </Box>
      <Text flex="1">{task.title}</Text>
    </HStack>
  );
}
