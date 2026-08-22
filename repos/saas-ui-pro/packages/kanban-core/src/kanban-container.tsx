import React, { forwardRef } from 'react'

import { DndContext } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { KanbanProvider } from './kanban-context'
import type { MaybeRenderProp } from './types'
import {
  type UseKanbanContainerProps,
  useKanbanContainer,
} from './use-kanban-container'
import { cx } from './utilities/cx'
import { type HTMLPulseProps, pulse } from './utilities/factory'
import { runIfFn } from './utilities/run-if-fn'
import { splitProps } from './utilities/split-props'

export interface KanbanProps
  extends UseKanbanContainerProps,
    Omit<HTMLPulseProps<'div'>, 'children' | 'onChange'> {
  orientation?: 'horizontal' | 'vertical'
  children: MaybeRenderProp<ReturnType<typeof useKanbanContainer>>
  isSortable?: boolean
}

export const Kanban = forwardRef<HTMLDivElement, KanbanProps>(
  function KanbanContainer(props, ref) {
    const [kanbanProps, htmlProps] = splitProps(props, [
      'orientation',
      'children',
      'isSortable',
      'items',
      'defaultItems',
      'onChange',
      'onItemsChange',
      'onCardDragEnd',
      'onColumnDragEnd',
      'isMoveAllowed',
    ])

    const { orientation = 'horizontal', children, isSortable } = kanbanProps

    const context = useKanbanContainer(props)

    const { getDndContextProps, columns } = context

    const isVertical = orientation === 'vertical'

    return (
      <KanbanProvider value={context}>
        <DndContext {...getDndContextProps()}>
          <pulse.div
            ref={ref}
            {...htmlProps}
            data-orientation={orientation}
            className={cx('sui-kanban', htmlProps.className)}
          >
            <SortableContext
              disabled={isSortable === false}
              items={columns}
              strategy={
                isVertical
                  ? verticalListSortingStrategy
                  : horizontalListSortingStrategy
              }
            >
              {runIfFn(children, context)}
            </SortableContext>
          </pulse.div>
        </DndContext>
      </KanbanProvider>
    )
  },
)
