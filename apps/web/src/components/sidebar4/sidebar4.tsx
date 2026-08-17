import * as React from "react";

import { Box, type HTMLChakraProps } from "@chakra-ui/react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import type {
  DndContextProps,
  DragEndEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LuGripVertical } from "react-icons/lu";

import * as Sidebar from "@/components/ui/sidebar/sidebar";

export interface SortableNavItemData {
  id: UniqueIdentifier;
}

export interface SortableNavGroupProps<Item extends SortableNavItemData>
  extends
    Omit<HTMLChakraProps<"div">, "onDragStart" | "onDragEnd" | "onDragOver">,
    Omit<DndContextProps, "children" | "id"> {
  items: Item[];
  onSorted?: React.Dispatch<React.SetStateAction<Item[]>>;
}

export function reorderNavItems<Item extends SortableNavItemData>(
  items: readonly Item[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
): Item[] {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return [...items];
  }

  return arrayMove([...items], activeIndex, overIndex);
}

export function SortableNavGroup<Item extends SortableNavItemData>(
  props: SortableNavGroupProps<Item>,
) {
  const {
    children,
    accessibility,
    autoScroll,
    cancelDrop,
    collisionDetection = closestCenter,
    measuring,
    modifiers,
    sensors,
    onDragAbort,
    onDragPending,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
    onDragCancel,
    onSorted,
    items,
    ...rest
  } = props;

  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const activeItem = React.Children.toArray(children).find(isSortableNavItem);
  const visibleActiveItem =
    activeItem?.props.id === activeId ? activeItem : undefined;

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;

    if (over) {
      onSorted?.((currentItems) =>
        reorderNavItems(currentItems, event.active.id, over.id),
      );
    }

    setActiveId(null);
  };

  return (
    <DndContext
      accessibility={accessibility}
      autoScroll={autoScroll}
      cancelDrop={cancelDrop}
      collisionDetection={collisionDetection}
      measuring={measuring}
      modifiers={modifiers}
      sensors={sensors}
      onDragAbort={onDragAbort}
      onDragPending={onDragPending}
      onDragStart={(event) => {
        setActiveId(event.active.id);
        onDragStart?.(event);
      }}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={(event) => {
        handleDragEnd(event);
        onDragEnd?.(event);
      }}
      onDragCancel={(event) => {
        setActiveId(null);
        onDragCancel?.(event);
      }}
    >
      <SortableContext items={items.map((item) => item.id)}>
        <Sidebar.GroupContent {...rest}>{children}</Sidebar.GroupContent>
      </SortableContext>
      <DragOverlay
        dropAnimation={{
          duration: 50,
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: "0.2",
              },
            },
          }),
        }}
      >
        {visibleActiveItem ? (
          <SortableNavOverlay {...visibleActiveItem.props} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export interface SortableNavItemProps extends Omit<Sidebar.NavItemProps, "id"> {
  id: UniqueIdentifier;
  handle?: React.ReactNode;
}

function isSortableNavItem(
  child: React.ReactNode,
): child is React.ReactElement<SortableNavItemProps> {
  return (
    React.isValidElement<SortableNavItemProps>(child) &&
    child.type === SortableNavItem
  );
}

function SortableNavOverlay(props: SortableNavItemProps) {
  const { id, handle, ...navItemProps } = props;
  void id;
  void handle;

  return (
    <Sidebar.NavItem
      {...navItemProps}
      my="0"
      _hover={{ bg: "transparent" }}
      opacity="0.8"
    />
  );
}

export const SortableNavItem: React.FC<SortableNavItemProps> = (props) => {
  const { id, children, handle, ...rest } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    transition: { duration: 150, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  });

  const itemProps = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
    ...attributes,
    ...listeners,
  };

  return (
    <Sidebar.NavItem
      ref={setNodeRef}
      {...rest}
      {...itemProps}
      data-dragging={isDragging || !!transform}
      data-sortable
      css={{
        position: "relative",
        a: {
          userSelect: "none",
          WebkitUserDrag: "none",
        },
      }}
    >
      {handle ?? (
        <Box
          pos="absolute"
          top="50%"
          transform="translateY(-50%)"
          left="-6px"
          color="fg.muted"
          opacity="0"
          cursor="grab"
          transitionProperty="all"
          transitionDuration="fast"
          data-drag-handle
          css={{
            "[data-sortable]:hover &": { opacity: 0.6, left: "-12px" },
            "[data-dragging] &": { opacity: 0 },
          }}
        >
          <LuGripVertical size="12" />
        </Box>
      )}
      {children}
    </Sidebar.NavItem>
  );
};
