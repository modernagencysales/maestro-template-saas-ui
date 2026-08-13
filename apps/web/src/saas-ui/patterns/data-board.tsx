import {
  Kanban,
  KanbanCard,
  KanbanColumn,
  KanbanColumnBody,
  KanbanColumnHeader,
  KanbanDragOverlay,
  type KanbanItems,
} from "@saas-ui-pro/kanban";
import { Button, Heading, Stack, Text } from "@saas-ui/react";
import { PageStateView } from "./page-states";

// Adapted from the pinned starter DataBoard and the official Pro Kanban package.
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

const kanbanItems = (
  columns: readonly BoardColumn[],
  items: readonly BoardItem[],
): KanbanItems =>
  Object.fromEntries(
    columns.map((column) => [
      column.id,
      items.filter((item) => item.columnId === column.id).map(({ id }) => id),
    ]),
  );

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

  const boardItems = kanbanItems(columns, items);
  const itemById = new Map(items.map((item) => [item.id, item]));
  return (
    <Kanban
      items={boardItems}
      onChange={(next) => {
        for (const [columnId, ids] of Object.entries(next))
          for (const id of ids) {
            const item = itemById.get(String(id));
            if (item && item.columnId !== columnId) onMove(item.id, columnId);
          }
      }}
    >
      {({ activeId, columns: columnIds, items: grouped }) => (
        <>
          {columnIds.map((columnId) => {
            const column = columns.find(({ id }) => id === columnId);
            return (
              <KanbanColumn id={columnId} key={columnId} width="20rem">
                <KanbanColumnHeader>
                  <Heading size="sm">{column?.title ?? columnId}</Heading>
                </KanbanColumnHeader>
                <KanbanColumnBody>
                  {grouped[columnId]?.map((itemId) => {
                    const item = itemById.get(String(itemId));
                    return item ? (
                      <KanbanCard id={item.id} key={item.id}>
                        <BoardCard
                          item={item}
                          columns={columns}
                          onMove={onMove}
                        />
                      </KanbanCard>
                    ) : null;
                  })}
                </KanbanColumnBody>
              </KanbanColumn>
            );
          })}
          <KanbanDragOverlay>
            {activeId ? (
              <Text>{itemById.get(String(activeId))?.title}</Text>
            ) : null}
          </KanbanDragOverlay>
        </>
      )}
    </Kanban>
  );
}

function BoardCard({
  item,
  columns,
  onMove,
}: {
  readonly item: BoardItem;
  readonly columns: readonly BoardColumn[];
  readonly onMove: (id: string, columnId: string) => void;
}) {
  const index = columns.findIndex(({ id }) => id === item.columnId);
  return (
    <Stack gap="2">
      <Text>{item.title}</Text>
      <Stack direction="row">
        <Button
          disabled={index === 0}
          onClick={() =>
            onMove(item.id, columns[index - 1]?.id ?? item.columnId)
          }
          size="xs"
          variant="ghost"
        >
          Move back
        </Button>
        <Button
          disabled={index === columns.length - 1}
          onClick={() =>
            onMove(item.id, columns[index + 1]?.id ?? item.columnId)
          }
          size="xs"
          variant="ghost"
        >
          Move forward
        </Button>
      </Stack>
    </Stack>
  );
}
