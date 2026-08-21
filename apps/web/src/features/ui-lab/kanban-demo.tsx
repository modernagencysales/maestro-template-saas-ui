import * as React from 'react'

import { Card } from '@chakra-ui/react'
import {
  Kanban,
  KanbanCard,
  KanbanColumn,
  KanbanColumnBody,
  KanbanColumnHeader,
  KanbanDragOverlay,
  type KanbanColumnProps,
  useKanbanContext,
} from '@saas-ui-pro/kanban'

const columns: Record<string, { title: string }> = {
  backlog: { title: 'Backlog' },
  todo: { title: 'Todo' },
  doing: { title: 'Doing' },
  done: { title: 'Done' },
  canceled: { title: 'Canceled' },
}

const createRange = <Value,>(
  length: number,
  value: (index: number) => Value,
) => Array.from({ length }, (_, index) => value(index))

const defaultItems = {
  backlog: createRange(20, (index) => `backlog${index + 1}`),
  todo: createRange(20, (index) => `todo${index + 1}`),
  doing: createRange(20, (index) => `doing${index + 1}`),
  done: createRange(20, (index) => `done${index + 1}`),
}

export function KanbanDemo() {
  return (
    <Kanban defaultItems={defaultItems} minH="640px">
      {({ columns: columnIds, items, activeId }) => (
        <>
          {columnIds.map((columnId) => (
            <BoardColumn key={columnId} id={columnId}>
              {(items[columnId] ?? []).map((itemId) => (
                <BoardCard key={itemId} id={itemId} />
              ))}
            </BoardColumn>
          ))}
          <KanbanDragOverlay>
            {activeId ? <BoardCard id={activeId} cursor="grabbing" /> : null}
          </KanbanDragOverlay>
        </>
      )}
    </Kanban>
  )
}

function BoardColumn({
  children,
  id,
  ...props
}: KanbanColumnProps & {
  disabled?: boolean
  id: string | number
}) {
  const { items } = useKanbanContext()

  return (
    <KanbanColumn id={id} {...props}>
      <KanbanColumnHeader>
        {columns[id]?.title} ({items[id]?.length})
      </KanbanColumnHeader>
      <KanbanColumnBody>{children}</KanbanColumnBody>
    </KanbanColumn>
  )
}

function BoardCard({
  id,
  children,
  ...props
}: Omit<React.ComponentProps<typeof KanbanCard>, 'children'> & {
  children?: React.ReactNode
}) {
  return (
    <KanbanCard id={id} isDisabled {...props}>
      <Card.Root minHeight="100px" w="full">
        <Card.Body>{children ?? id}</Card.Body>
      </Card.Root>
    </KanbanCard>
  )
}
