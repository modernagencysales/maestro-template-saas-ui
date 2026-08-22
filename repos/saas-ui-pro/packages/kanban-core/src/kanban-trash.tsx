import { forwardRef } from 'react'

import { useDroppable } from '@dnd-kit/core'

import { useKanbanContext } from './kanban-context'
import { dataAttr } from './utilities/data-attr'
import { HTMLPulseProps, pulse } from './utilities/factory'
import { useMergeRefs } from './utilities/use-merge-refs'

export const KanbanTrash = forwardRef<HTMLDivElement, HTMLPulseProps<'div'>>(
  (props, forwardedRef) => {
    const { activeId, columns } = useKanbanContext()

    const { setNodeRef, isOver } = useDroppable({
      id: 'void',
    })

    if (!activeId || columns.includes(activeId)) {
      return null
    }

    const ref = useMergeRefs(forwardedRef, setNodeRef as any)

    return (
      <pulse.div ref={ref} data-over={dataAttr(isOver)} {...props}>
        {props.children}
      </pulse.div>
    )
  },
)
