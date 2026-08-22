import { Portal, PortalProps } from '@chakra-ui/react'
import {
  KanbanDragOverlay as KanbanDragOverlayCore,
  type KanbanDragOverlayProps as KanbanDragOverlayCoreProps,
} from '@saas-ui-pro/kanban-core'

export interface KanbanDragOverlayProps
  extends KanbanDragOverlayCoreProps,
    Omit<PortalProps, 'children'> {}

export const KanbanDragOverlay: React.FC<KanbanDragOverlayProps> = (props) => {
  const { children, container, dropAnimation, ...rest } = props
  return (
    <Portal container={container}>
      <KanbanDragOverlayCore {...rest} dropAnimation={dropAnimation}>
        {children}
      </KanbanDragOverlayCore>
    </Portal>
  )
}
