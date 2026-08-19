import React, { forwardRef } from 'react'

import { UniqueIdentifier } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { KanbanActionProps, KanbanHandle } from './kanban-action'
import { useKanbanContext } from './kanban-context'
import { animateLayoutChanges } from './utilities/animate-layout-changes'
import { cx } from './utilities/cx'
import { dataAttr } from './utilities/data-attr'
import { HTMLPulseProps, pulse } from './utilities/factory'
import { useMergeRefs } from './utilities/use-merge-refs'

export type KanbanColumnContext = ReturnType<typeof useKanbanColumn>

const KanbanColumnContext = React.createContext<KanbanColumnContext | null>(
  null,
)

export const useKanbanColumnContext = () => {
  const context = React.useContext(KanbanColumnContext)

  if (!context) {
    throw new Error('useKanbanColumnContext must be used within a KanbanColumn')
  }

  return context
}

export const KanbanColumnProvider = KanbanColumnContext.Provider

const useKanbanColumn = (props: KanbanColumnProps) => {
  const {
    id,
    orientation = 'vertical',
    isDisabled,
    sortable = true,
    style,
  } = props
  const { items } = useKanbanContext()

  const columnItems = items[id] ?? []

  const {
    active,
    attributes,
    isDragging,
    listeners,
    over,
    setNodeRef,
    transition,
    transform,
  } = useSortable({
    id,
    disabled: isDisabled,
    data: {
      type: 'Column',
      children: columnItems,
    },
    animateLayoutChanges,
  })

  const isOverColumn = over
    ? (id === over.id && active?.data.current?.type !== 'Column') ||
      columnItems.includes(over.id)
    : false

  return {
    id,
    sortable,
    orientation,
    items: columnItems,
    columnRef: isDisabled ? null : setNodeRef,
    getColumnProps: React.useCallback(
      () => ({
        style: {
          ...style,
          transition,
          transform: CSS.Translate.toString(transform),
        } as React.CSSProperties,
        ['data-orientation']: orientation,
        ['data-dragging']: dataAttr(isDragging),
        ['data-over']: dataAttr(isOverColumn),
      }),
      [transition, transform, isDragging, isOverColumn, orientation, style],
    ),
    getHandleProps: React.useCallback(
      () => ({
        ...attributes,
        ...listeners,
      }),
      [attributes, listeners],
    ),
  }
}

export interface KanbanColumnProps extends Omit<HTMLPulseProps<'div'>, 'id'> {
  /**
   * The unique id of the column.
   */
  id: UniqueIdentifier
  /**
   * Whether the column items are sortable.
   * @default true
   */
  sortable?: boolean
  /**
   * Whether the column is disabled.
   */
  isDisabled?: boolean
  /**
   * The orientation of the column.
   */
  orientation?: 'horizontal' | 'vertical'
  /**
   * The children of the column.
   */
  children: React.ReactNode
}

export const KanbanColumn = forwardRef<HTMLDivElement, KanbanColumnProps>(
  function KanbanColumn(props, ref) {
    const {
      id,
      children,
      onClick,
      isDisabled,
      sortable = true,
      ...rest
    } = props

    const context = useKanbanColumn(props)

    return (
      <KanbanColumnProvider value={context}>
        <pulse.div
          {...rest}
          data-column={id}
          data-disabled={dataAttr(isDisabled)}
          data-sortable={dataAttr(sortable)}
          ref={useMergeRefs(ref, context.columnRef as any)}
          onClick={onClick}
          tabIndex={onClick ? 0 : undefined}
          className={cx('sui-kanban__column', props.className)}
          {...context.getColumnProps()}
        >
          {children}
        </pulse.div>
      </KanbanColumnProvider>
    )
  },
)

export const KanbanColumnBody = forwardRef<
  HTMLUListElement,
  HTMLPulseProps<'ul'>
>(function KanbanColumnBody(props, ref) {
  const { children, ...rest } = props
  const { orientation, sortable, items } = useKanbanColumnContext()

  const isVertical = orientation !== 'horizontal'

  const strategy = isVertical
    ? verticalListSortingStrategy
    : horizontalListSortingStrategy

  return (
    <pulse.ul
      {...rest}
      ref={ref}
      className={cx('sui-kanban__column-body', props.className)}
    >
      <SortableContext
        disabled={!sortable || !items?.length}
        items={items}
        strategy={strategy}
      >
        {children}
      </SortableContext>
    </pulse.ul>
  )
})

export const KanbanColumnHeader = forwardRef<
  HTMLDivElement,
  HTMLPulseProps<'header'>
>(function KanbanColumnHeader(props, ref) {
  const { children, ...rest } = props

  return (
    <pulse.header
      ref={ref}
      {...rest}
      className={cx('sui-kanban__column-header', props.className)}
    >
      {children}
    </pulse.header>
  )
})

export const KanbanColumnActions = forwardRef<
  HTMLDivElement,
  HTMLPulseProps<'div'>
>(function KanbanColumnActions(props, ref) {
  const { children, ...rest } = props

  return (
    <pulse.div
      ref={ref}
      {...rest}
      className={cx('sui-kanban__column-actions', props.className)}
    >
      {children}
    </pulse.div>
  )
})

export interface KanbanColumnDragHandleProps extends KanbanActionProps {}

/**
 *
 */
export const KanbanColumnDragHandle = forwardRef<
  HTMLButtonElement,
  KanbanColumnDragHandleProps
>(function KanbanColumnDragHandle(props, ref) {
  const { getHandleProps } = useKanbanColumnContext()

  return <KanbanHandle ref={ref} {...getHandleProps()} {...props} />
})
