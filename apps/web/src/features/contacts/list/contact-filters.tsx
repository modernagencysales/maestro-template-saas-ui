import * as React from "react";

import {
  FilterItem,
  FilterMenu,
  FilterMenuProps,
  useFiltersContext,
} from "@saas-ui-pro/react";
import { useDisclosure } from "@saas-ui/react";
import { useHotkeysShortcut } from "@saas-ui/use-hotkeys";
import { formatDistanceToNowStrict, startOfDay, subDays } from "date-fns";
import { LuCalendar, LuFilter, LuTag } from "react-icons/lu";

import { StatusBadge } from "@workspace/ui/status-badge";
import { TagColor } from "@workspace/ui/tags-list";

import { useTags } from "#features/common/hooks/use-tags";

const days = [1, 2, 3, 7, 14, 21, 31, 60];

export const useContactFilters = () => {
  const tags = useTags();

  return React.useMemo<FilterItem[]>(() => {
    return [
      {
        id: "status",
        label: "Status",
        icon: <StatusBadge colorScheme="gray" />,
        type: "enum",
        items: [
          {
            id: "new",
            label: "New",
            icon: <StatusBadge colorScheme="blue" />,
          },
          {
            id: "active",
            label: "Active",
            icon: <StatusBadge colorScheme="green" />,
          },
          {
            id: "inactive",
            label: "Inactive",
            icon: <StatusBadge colorScheme="yellow" />,
          },
        ],
      },
      {
        id: "tags",
        label: "Tags",
        icon: <LuTag />,
        type: "string",
        defaultOperator: "contains",
        operators: ["contains", "containsNot"],
        items: () => {
          return (
            tags?.map<FilterItem>((tag) => {
              return {
                id: tag.id,
                label: tag.name,
                icon: <TagColor color={tag.color ?? undefined} />,
              };
            }) || []
          );
        },
      },
      {
        id: "createdAt",
        label: "Created at",
        icon: <LuCalendar />,
        type: "date",
        operators: ["after", "before"],
        defaultOperator: "after",
        items: days
          .map((day): FilterItem => {
            const date = startOfDay(subDays(new Date(), day));
            return {
              id: `${day}days`,
              label: formatDistanceToNowStrict(date, { addSuffix: true }),
              value: date,
            };
          })
          .concat([{ id: "custom", label: "Custom" }]),
      },
    ];
  }, [tags]);
};

export const AddFilterButton: React.FC<Omit<FilterMenuProps, "items">> = (
  props,
) => {
  const disclosure = useDisclosure();

  const filterCommand = useHotkeysShortcut("general.filter", () => {
    disclosure.onOpen();
  });

  const menuRef = React.useRef<HTMLButtonElement>(null);

  const { enableFilter } = useFiltersContext();

  const onSelect = async (item: FilterItem) => {
    const { id, value } = item;
    await enableFilter({ id, operator: item.defaultOperator, value });
  };

  const filters = useContactFilters();

  return (
    <FilterMenu
      items={filters}
      icon={<LuFilter />}
      ref={menuRef}
      command={filterCommand}
      buttonProps={{ variant: "ghost", size: "xs" }}
      onSelect={onSelect}
      {...disclosure}
      {...props}
    />
  );
};
