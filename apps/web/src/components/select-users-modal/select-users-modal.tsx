import React, { useMemo, useState } from "react";

import { Box, Heading, Text } from "@chakra-ui/react";

import * as Dialog from "@/components/ui/dialog/dialog";
import * as GridList from "@/components/ui/grid-list/grid-list";
import { Button } from "@/components/ui/button/button";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { SearchInput } from "@/components/ui/search-input/search-input";

export interface SelectListModalItem {
  id: string | number;
  label?: string;
}

export interface SelectListModalProps<
  Item extends SelectListModalItem = SelectListModalItem,
> extends Omit<Dialog.RootProps, "children"> {
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  items: Array<Item>;
  renderItem?: (item: Item) => React.ReactNode;
  filterFn?: (item: Item, searchTerm: string) => boolean;
  onSubmit?: (ids: Array<Item["id"]>) => void;
}

export const SelectListModal = <
  Item extends SelectListModalItem = SelectListModalItem,
>(
  props: SelectListModalProps<Item>,
) => {
  const { onOpenChange, items, filterFn, ...rest } = props;
  const [selected, setSelected] = useState<Array<Item["id"]>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSelect = (id: Item["id"]) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id],
    );
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return items;
    }

    return items.filter((item) => {
      if (filterFn) {
        return filterFn(item, searchTerm);
      }
      return item.label?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [filterFn, items, searchTerm]);

  const renderItem = React.useCallback(
    (item: Item) => {
      if (props.renderItem) {
        return props.renderItem(item);
      }
      return <Text>{item.label}</Text>;
    },
    [props.renderItem],
  );

  const noResults = searchTerm && filteredItems.length === 0 && (
    <GridList.Item>
      <GridList.Cell py="2" px="4" textAlign="center">
        No results for "{searchTerm}"
      </GridList.Cell>
    </GridList.Item>
  );

  return (
    <Dialog.Root
      onOpenChange={onOpenChange}
      initialFocusEl={() => inputRef.current}
      {...rest}
    >
      <Dialog.Content>
        <Dialog.Header borderBottomWidth="1px">
          <Box width="100%">
            <Heading fontSize="lg" fontWeight="medium">
              {props.title}
            </Heading>
            <Text fontSize="sm" fontWeight="normal" color="fg.muted" mb={2}>
              {props.description}
            </Text>
            <SearchInput
              ref={inputRef}
              width="100%"
              size="sm"
              placeholder={props.searchPlaceholder || "Search..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onReset={() => setSearchTerm("")}
              onKeyDown={(e) => {
                // prevent modal from closing
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
          </Box>
          <Dialog.CloseButton position="absolute" right="4" top="4" />
        </Dialog.Header>

        <Dialog.Body p="0">
          <GridList.Root overflowY="auto" maxHeight="80vh" py="0">
            {noResults}
            {filteredItems.map((item) => (
              <GridList.Item
                key={item.id}
                onClick={() => handleSelect(item.id)}
                data-selected={selected.includes(item.id) ? "" : undefined}
                _selected={{
                  backgroundColor: "blackAlpha.100",
                  _dark: {
                    backgroundColor: "whiteAlpha.100",
                  },
                }}
                onKeyUp={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleSelect(item.id);
                  }
                }}
              >
                <GridList.Cell ps="4">{renderItem(item)}</GridList.Cell>
                <GridList.Cell pe="4">
                  <Checkbox
                    key={item.id}
                    checked={selected.includes(item.id)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyUp={(event) => event.stopPropagation()}
                    onCheckedChange={() => handleSelect(item.id)}
                  />
                </GridList.Cell>
              </GridList.Item>
            ))}
          </GridList.Root>
        </Dialog.Body>
        <Dialog.Footer borderTopWidth="1px">
          <Dialog.CloseTrigger asChild>
            <Button variant="ghost" mr={3}>
              Cancel
            </Button>
          </Dialog.CloseTrigger>
          <Button
            variant="glass"
            colorPalette="accent"
            onClick={() => props.onSubmit?.(selected)}
          >
            Add users
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
