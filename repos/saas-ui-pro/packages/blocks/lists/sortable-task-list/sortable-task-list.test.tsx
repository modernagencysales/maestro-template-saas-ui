// @vitest-environment jsdom
import * as React from 'react'
import { act } from 'react'

import type {
  DndContextProps,
  DragCancelEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { KeyboardSensor } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { type Root, createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SortableTaskList, type Task, reorderTasks } from './sortable-task-list'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const captured = vi.hoisted<{
  contextProps?: DndContextProps
  sensors: Array<{ sensor: unknown; options?: unknown }>
}>(() => ({ sensors: [] }))

vi.mock('@dnd-kit/core', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  function KeyboardSensor() {}
  function MouseSensor() {}
  function TouchSensor() {}

  return {
    DndContext: (props: DndContextProps) => {
      captured.contextProps = props
      return <>{props.children}</>
    },
    DragOverlay: ({ children }: React.PropsWithChildren) =>
      children ? <div data-testid="drag-overlay">{children}</div> : null,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCenter: vi.fn(),
    useSensor: (sensor: unknown, options?: unknown) => ({ sensor, options }),
    useSensors: (...sensors: Array<{ sensor: unknown; options?: unknown }>) => {
      captured.sensors = sensors
      return sensors
    },
  }
})

vi.mock('@dnd-kit/modifiers', () => ({ snapCenterToCursor: vi.fn() }))

vi.mock('@dnd-kit/sortable', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    SortableContext: ({ children }: React.PropsWithChildren) => <>{children}</>,
    arrayMove: <Item,>(items: Item[], from: number, to: number) => {
      const result = [...items]
      const [item] = result.splice(from, 1)
      result.splice(to, 0, item)
      return result
    },
    sortableKeyboardCoordinates: vi.fn(),
    useSortable: () => ({
      active: null,
      attributes: {},
      listeners: {},
      over: null,
      setNodeRef: vi.fn(),
    }),
  }
})

vi.mock('@chakra-ui/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  const Primitive = React.forwardRef<HTMLDivElement, React.PropsWithChildren>(
    function Primitive({ children }, ref) {
      return <div ref={ref}>{children}</div>
    },
  )
  return {
    Box: Primitive,
    HStack: Primitive,
    Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Text: Primitive,
  }
})

vi.mock('#registry/default/ui/checkbox/checkbox', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    Checkbox: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  }
})

vi.mock('#registry/default/ui/grid-list/grid-list', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  const Primitive = React.forwardRef<HTMLDivElement, React.PropsWithChildren>(
    function Primitive({ children }, ref) {
      return <div ref={ref}>{children}</div>
    },
  )
  return {
    Cell: Primitive,
    Header: Primitive,
    Item: Primitive,
    Root: Primitive,
  }
})

vi.mock('#registry/default/ui/tag/tag', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    Tag: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  }
})

const tasks: Task[] = [
  { id: 'a', title: 'A', date: '', labels: [], status: 'todo' },
  { id: 'b', title: 'B', date: '', labels: [], status: 'todo' },
  { id: 'c', title: 'C', date: '', labels: [], status: 'progress' },
  { id: 'd', title: 'D', date: '', labels: [], status: 'progress' },
  { id: 'e', title: 'E', date: '', labels: [], status: 'done' },
]

describe('reorderTasks', () => {
  it('reorders tasks within one group using task indices', () => {
    const result = reorderTasks(tasks, 'b', { type: 'task', id: 'a' })

    expect(result.map((task) => task.id)).toEqual(['b', 'a', 'c', 'd', 'e'])
    expect(result.map((task) => task.status)).toEqual([
      'todo',
      'todo',
      'progress',
      'progress',
      'done',
    ])
  })

  it('moves a task across groups when another task is the target', () => {
    const result = reorderTasks(tasks, 'e', { type: 'task', id: 'c' })

    expect(result.map((task) => task.id)).toEqual(['a', 'b', 'e', 'c', 'd'])
    expect(result.find((task) => task.id === 'e')?.status).toBe('progress')
  })

  it('translates a header boundary to the preceding current task group', () => {
    const result = reorderTasks(tasks, 'e', {
      type: 'header',
      status: 'progress',
    })

    expect(result.map((task) => task.id)).toEqual(['a', 'b', 'e', 'c', 'd'])
    expect(result.find((task) => task.id === 'e')?.status).toBe('todo')
  })

  it('does not treat a header position as a task array index', () => {
    const result = reorderTasks(tasks, 'a', {
      type: 'header',
      status: 'done',
    })

    expect(result.map((task) => task.id)).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(result.find((task) => task.id === 'a')?.status).toBe('progress')
  })

  it('rejects the boundary above the first group', () => {
    expect(
      reorderTasks(tasks, 'e', { type: 'header', status: 'todo' }),
    ).toEqual(tasks)
  })

  it('looks up active and preceding tasks in the supplied current state', () => {
    const currentTasks = tasks.map((task) =>
      task.id === 'e'
        ? { ...task, title: 'Current E', status: 'progress' }
        : task,
    )
    const result = reorderTasks(currentTasks, 'e', {
      type: 'header',
      status: 'done',
    })

    expect(result.find((task) => task.id === 'e')).toMatchObject({
      title: 'Current E',
      status: 'progress',
    })
  })
})

describe('SortableTaskList drag lifecycle', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    captured.contextProps = undefined
    captured.sensors = []
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('synchronizes changed task props before resolving the active overlay', () => {
    act(() => root.render(<SortableTaskList tasks={[tasks[0]]} />))

    const synchronizedTask = { ...tasks[0], title: 'Synchronized title' }
    act(() => root.render(<SortableTaskList tasks={[synchronizedTask]} />))
    act(() => captured.contextProps?.onDragStart?.(dragStartEvent('a')))

    expect(
      container.querySelector('[data-testid="drag-overlay"]')?.textContent,
    ).toBe('Synchronized title')
  })

  it('clears the overlay on cancel and keeps the keyboard coordinate path', () => {
    act(() => root.render(<SortableTaskList tasks={[tasks[0]]} />))
    act(() => captured.contextProps?.onDragStart?.(dragStartEvent('a')))

    expect(
      container.querySelector('[data-testid="drag-overlay"]'),
    ).not.toBeNull()

    act(() => captured.contextProps?.onDragCancel?.(dragCancelEvent('a')))

    expect(container.querySelector('[data-testid="drag-overlay"]')).toBeNull()
    expect(captured.sensors).toContainEqual({
      sensor: KeyboardSensor,
      options: { coordinateGetter: sortableKeyboardCoordinates },
    })
  })
})

function dragStartEvent(id: string): DragStartEvent {
  return {
    active: {
      id,
      data: { current: {} },
      rect: { current: { initial: null, translated: null } },
    },
    activatorEvent: new Event('keydown'),
  }
}

function dragCancelEvent(id: string): DragCancelEvent {
  return {
    ...dragStartEvent(id),
    collisions: null,
    delta: { x: 0, y: 0 },
    over: null,
  }
}
