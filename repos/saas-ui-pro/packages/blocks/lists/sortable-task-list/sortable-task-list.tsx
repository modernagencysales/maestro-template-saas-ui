import * as React from 'react'

import { Box, HStack, Portal, Text } from '@chakra-ui/react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Active,
  DndContextProps,
  DragEndEvent,
  Over,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'

import * as GridList from '#registry/default/ui/grid-list/grid-list'
import { Checkbox } from '#registry/default/ui/checkbox/checkbox'
import { Tag } from '#registry/default/ui/tag/tag'

export interface SortableTaskListProps extends Omit<
  DndContextProps,
  'children'
> {
  tasks: Task[]
  states?: TaskStates
}

export type SortableTaskDropTarget =
  | { type: 'task'; id: UniqueIdentifier }
  | { type: 'header'; status: string }

/**
 * Reorders a task using task indices only. Header positions are translated to
 * the last task in the preceding group before the move is applied.
 */
export function reorderTasks(
  items: readonly Task[],
  activeId: UniqueIdentifier,
  target: SortableTaskDropTarget,
): Task[] {
  const activeIndex = items.findIndex((item) => item.id === activeId)
  if (activeIndex < 0) return [...items]

  const activeItem = items[activeIndex]

  if (target.type === 'task') {
    const overIndex = items.findIndex((item) => item.id === target.id)
    if (overIndex < 0 || activeIndex === overIndex) return [...items]

    const overItem = items[overIndex]
    const nextItems = [...items]
    nextItems[activeIndex] =
      activeItem.status === overItem.status
        ? activeItem
        : { ...activeItem, status: overItem.status }

    return arrayMove(nextItems, activeIndex, overIndex)
  }

  const groupOrder = Array.from(new Set(items.map((item) => item.status)))
  const headerIndex = groupOrder.indexOf(target.status)

  // A header represents the boundary below the preceding group. There is no
  // valid destination above the first header.
  if (headerIndex <= 0) return [...items]

  const destinationStatus = groupOrder[headerIndex - 1]
  const movedItem =
    activeItem.status === destinationStatus
      ? activeItem
      : { ...activeItem, status: destinationStatus }
  const remainingItems = items.filter((_, index) => index !== activeIndex)
  let previousGroupEnd = -1
  remainingItems.forEach((item, index) => {
    if (item.status === destinationStatus) previousGroupEnd = index
  })

  remainingItems.splice(previousGroupEnd + 1, 0, movedItem)
  return remainingItems
}

const useSortableTaskList = (props: SortableTaskListProps) => {
  const {
    tasks,
    states = taskStates,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
    ...rest
  } = props

  const [items, setItems] = React.useState<Task[]>(tasks)

  React.useEffect(() => {
    setItems(tasks)
  }, [tasks])

  const [groupedItems, flatIds] = React.useMemo(() => {
    const groupedItems: Record<string, Task[]> = {}
    const flatIds: string[] = []

    for (const task of items) {
      if (!groupedItems[task.status]) {
        groupedItems[task.status] = []
        flatIds.push(getHeaderId(task.status))
      }

      groupedItems[task.status].push(task)
      flatIds.push(task.id)
    }

    return [groupedItems, flatIds]
  }, [items])

  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null)

  const activeItem = items.find((task) => task.id === activeId)

  const handleDragEnd = (event: DragEndEvent) => {
    const overType = event.over?.data.current?.type
    let target: SortableTaskDropTarget | undefined

    if (overType === 'task' && event.over) {
      target = { type: 'task', id: event.over.id }
    } else if (
      overType === 'header' &&
      typeof event.over?.data.current?.status === 'string'
    ) {
      target = {
        type: 'header',
        status: event.over.data.current.status,
      }
    }

    if (target) {
      setItems((currentItems) =>
        reorderTasks(currentItems, event.active.id, target),
      )
    }
    setActiveId(null)
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const dndContextProps: DndContextProps = {
    collisionDetection: closestCenter,
    sensors,
    onDragStart: (event) => {
      if (!event.active) {
        return
      }
      setActiveId(event.active.id)
      onDragStart?.(event)
    },
    onDragOver,
    onDragEnd: (event) => {
      handleDragEnd(event)
      onDragEnd?.(event)
    },
    onDragCancel: (event) => {
      setActiveId(null)
      onDragCancel?.(event)
    },
    ...rest,
  }

  return {
    dndContextProps,
    items,
    groupedItems,
    flatIds,
    activeItem,
    states,
  }
}

export const SortableTaskList: React.FC<SortableTaskListProps> = (props) => {
  const { dndContextProps, groupedItems, flatIds, activeItem, states } =
    useSortableTaskList(props)

  return (
    <DndContext {...dndContextProps}>
      <SortableContext items={flatIds}>
        <GridList.Root py="0" interactive>
          {Object.entries(groupedItems).map(([status, tasks]) => (
            <React.Fragment key={status}>
              <TaskListHeader
                id={status}
                isFirst={flatIds[0] === getHeaderId(status)}
                title={states[status]?.label}
                total={tasks.length}
              />
              {tasks.map((task) => (
                <TaskListItem key={task.id} task={task} />
              ))}
            </React.Fragment>
          ))}
        </GridList.Root>
        <Portal>
          {activeItem ? (
            <DragOverlay
              style={{ minWidth: 200 }}
              modifiers={[snapCenterToCursor]}
            >
              <TaskListDragItem task={activeItem} />
            </DragOverlay>
          ) : null}
        </Portal>
      </SortableContext>
    </DndContext>
  )
}

const getHeaderId = (id: string) => `task-list-header-${id}`

const TaskListHeader: React.FC<{
  id: string
  isFirst: boolean
  title?: string
  total: number
}> = (props) => {
  const id = getHeaderId(props.id)

  const { setNodeRef, over, active } = useSortable({
    id,
    data: {
      type: 'header',
      status: props.id,
      isFirstHeader: props.isFirst,
    },
    disabled: { draggable: true },
  })

  const itemProps = useSortableProps({
    active,
    over,
    id,
  })

  return (
    <Box
      as="li"
      ref={setNodeRef}
      {...itemProps}
      listStyleType="none"
      position="relative"
    >
      <GridList.Header as="div" fontWeight="normal" bg="bg.muted" color="fg">
        {props.title ?? props.id}
        <Text as="span" color="fg.muted" ms="2">
          {props.total}
        </Text>
      </GridList.Header>
    </Box>
  )
}

const TaskListDragItem: React.FC<{ task: Task }> = (props) => {
  return (
    <Box
      display="inline-block"
      px="3"
      py="2"
      boxShadow="md"
      borderRadius="md"
      borderWidth="1px"
      textStyle="sm"
      bg="bg.panel"
      width="auto"
      cursor="grabbing"
      userSelect="none"
    >
      {props.task.title}
    </Box>
  )
}

const useSortableProps = ({
  id,
  active,
  over,
}: {
  id: string
  active: Active | null
  over: Over | null
}) => {
  // make sure items can't be dropped above the first header.
  if (
    id === over?.id &&
    over?.data.current?.type === 'header' &&
    over.data.current.isFirstHeader === true
  ) {
    return {
      'data-dnd-dragging': 'false',
      'data-dnd-over': 'false',
      'data-dnd-below-active': 'false',
    }
  }

  const activeIndex = active?.data.current?.sortable?.index
  const overIndex = over?.data.current?.sortable?.index

  return {
    'data-dnd-dragging': active?.id === id ? 'true' : 'false',
    'data-dnd-over':
      active?.id !== over?.id && over?.id === id ? 'true' : 'false',
    'data-dnd-below-active':
      typeof activeIndex === 'number' && typeof overIndex === 'number'
        ? overIndex > activeIndex
          ? 'true'
          : 'false'
        : 'false',
    css: {
      '&[data-dnd-dragging=true]': {
        opacity: 0.5,
      },
      '&[data-dnd-over=true]': {
        _after: {
          content: '""',
          position: 'absolute',
          width: '100%',
          height: '2px',
          background: 'accent.solid',
        },
      },
      '&[data-dnd-below-active=false][data-dnd-over=true]': {
        _after: {
          top: '-1px',
        },
      },
      '&[data-dnd-below-active=true][data-dnd-over=true]': {
        _after: {
          bottom: '-1px',
        },
      },
    },
  }
}

const TaskListItem: React.FC<{ task: Task }> = (props) => {
  const { task } = props

  const { attributes, listeners, setNodeRef, over, active } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  })

  const itemProps = useSortableProps({
    active,
    over,
    id: task.id,
  })

  return (
    <GridList.Item
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...itemProps}
      position="relative"
      borderBottom="1px"
      borderColor="border.muted"
      textStyle="sm"
    >
      <GridList.Cell width="4" role="group">
        <Checkbox
          opacity="0"
          _checked={{ opacity: 1 }}
          _groupHover={{ opacity: 1 }}
          size="md"
          rounded="sm"
        />
      </GridList.Cell>
      <GridList.Cell color="fg.muted">{task.id}</GridList.Cell>
      <GridList.Cell flex="1">
        <Text lineClamp={1}>{task.title}</Text>
      </GridList.Cell>
      <GridList.Cell color="fg.muted" display={{ base: 'none', md: 'flex' }}>
        <HStack gap="1">
          {task.labels.map((label) => (
            <Tag key={label} rounded="full">
              {label}
            </Tag>
          ))}
        </HStack>
        <HStack flexShrink="0" width="60px" justifyContent="flex-end">
          <Text color="fg.muted">{task.date}</Text>
        </HStack>
      </GridList.Cell>
    </GridList.Item>
  )
}

export type TaskStates = Record<string, { label: string; color: string }>

const taskStates: TaskStates = {
  todo: {
    label: 'To do',
    color: 'gray',
  },
  'in-progress': {
    label: 'In progress',
    color: 'yellow',
  },
  done: {
    label: 'Done',
    color: 'green',
  },
}

export interface Task {
  id: string
  title: string
  date: string
  labels: string[]
  status: string
}
