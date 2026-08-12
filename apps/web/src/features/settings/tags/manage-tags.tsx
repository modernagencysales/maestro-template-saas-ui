import React, { useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Collapsible,
  Field,
  Flex,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
  VisuallyHidden,
  useControllableState,
} from "@chakra-ui/react";
import { GridList, SearchInput } from "@saas-ui/react";
import { LuPencil, LuTrash } from "react-icons/lu";

import { useOpenState } from "#hooks/use-open-state";

import { ColorControl } from "./color-control";

export interface Tag {
  id: string;
  name: string;
  count?: number;
  color?: string | null;
}

interface TagListItemProps {
  colors: string[];
  item: Tag;
  isEditing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: (tag: Tag) => Promise<void>;
  onDelete?: () => void;
}

const TagListItem: React.FC<TagListItemProps> = (props) => {
  const {
    colors,
    item,
    isEditing,
    onEdit: onEditProp,
    onCancel: onCancelProp,
    onSave: onSaveProp,
    onDelete: onDeleteProp,
  } = props;

  const [edit, setEdit] = useControllableState({
    value: isEditing,
    defaultValue: false,
  });

  const [error, setError] = React.useState("");
  const [isLoading, setLoading] = React.useState(false);

  const [values, setValues] = useState({
    color: item.color,
    name: item.name,
  });

  const onEdit = () => {
    setValues({
      color: item.color,
      name: item.name,
    });
    setEdit(true);
    onEditProp?.();
  };

  const onCancel = () => {
    setEdit(false);
    setValues({
      color: item.color,
      name: item.name,
    });
    setError("");
    onCancelProp?.();
  };

  const onSave = async () => {
    try {
      setError("");
      setLoading(true);

      await onSaveProp?.({
        ...item,
        ...values,
      });

      setEdit(false);
    } catch (e: any) {
      setError(e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const color = values.color ?? item.color ?? undefined;

  const colorBadge = (
    <Box bgColor={`colors.tag.${color}`} borderRadius="full" boxSize="2.5" />
  );

  return edit ? (
    <GridList.Item
      role="group"
      py="1"
      bg="bg.subtle"
      borderRadius="md"
      mb="1.5"
      gap="2"
    >
      <GridList.Cell px="0">
        <ColorControl
          value={color}
          colors={colors}
          onChange={(color) =>
            setValues((values) => ({
              ...values,
              color,
            }))
          }
        />
      </GridList.Cell>
      <GridList.Cell display="flex" alignItems="center" flex="1" gap="2" px="0">
        <Field.Root invalid={!!error}>
          <Field.Label display="none">Label</Field.Label>
          <Input
            type="text"
            defaultValue={item.name}
            value={values.name}
            size="sm"
            autoFocus
            px="2"
            bg="chakra-body-bg"
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                // prevent modal from closing
                e.preventDefault();
                e.stopPropagation();

                // cancel editing
              } else if (e.key === "Enter") {
                // save changes
                onSave();
              }
            }}
          />
        </Field.Root>
      </GridList.Cell>
      <GridList.Cell display="flex" gap="2">
        <Button variant="ghost" size="sm" onClick={() => onCancel()}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={isLoading}
          onClick={() => onSave()}
        >
          Save
        </Button>
      </GridList.Cell>
    </GridList.Item>
  ) : (
    <GridList.Item
      role="group"
      py="1"
      bg="bg.subtle"
      borderRadius="md"
      mb="1.5"
      gap="2"
    >
      <GridList.Cell px="0">
        <Flex
          border="1px solid transparent"
          boxSize="7"
          alignItems="center"
          justifyContent="center"
        >
          {colorBadge}
        </Flex>
      </GridList.Cell>
      <GridList.Cell display="flex" alignItems="center" flex="1" gap="2">
        <Text as="span" fontSize="sm">
          {item.name}
        </Text>
        <Text as="span" fontSize="xs" color="fg.muted">
          {item.count}
        </Text>
      </GridList.Cell>
      <GridList.Cell
        display="flex"
        gap="2"
        opacity="0"
        _groupHover={{ opacity: 1 }}
      >
        <IconButton
          size="xs"
          aria-label="edit"
          variant="ghost"
          onClick={() => onEdit()}
        >
          <LuPencil />
        </IconButton>
        <IconButton
          size="xs"
          aria-label="Delete"
          variant="ghost"
          onClick={() => onDeleteProp?.()}
        >
          <LuTrash />
        </IconButton>
      </GridList.Cell>
    </GridList.Item>
  );
};

interface TagListAddItemProps {
  colors?: string[];
  open?: boolean;
  onCancel?: () => void;
  onSave?: (tag: Pick<Tag, "color" | "name">) => Promise<void>;
}

const TagListAddItem: React.FC<TagListAddItemProps> = (props) => {
  const { colors, open, onCancel: onCancelProp, onSave: onSaveProp } = props;

  const inputRef = React.useRef<HTMLInputElement>(null);

  const openState = useOpenState({
    open,
    onOpenChange(details) {
      if (!details.open) {
        setValues({
          color: "gray",
          name: "",
        });
      }
    },
  });

  useEffect(() => {
    if (openState.open) {
      setTimeout(() => {
        inputRef.current?.focus();
      });
    }
  }, [openState.open]);

  const [error, setError] = React.useState("");
  const [isLoading, setLoading] = React.useState(false);

  const [values, setValues] = useState({
    color: "gray",
    name: "",
  });

  const onCancel = () => {
    setError("");
    openState.setOpen(false);
    onCancelProp?.();
  };

  const onSave = async () => {
    try {
      setError("");
      setLoading(true);

      await onSaveProp?.(values);

      openState.setOpen(false);
    } catch (e: any) {
      setError(e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible.Root open={openState.open}>
      <Collapsible.Content>
        <HStack
          role="group"
          py="2"
          bg="bg.subtle"
          px="2"
          borderWidth="1px"
          borderRadius="md"
        >
          <Box>
            <ColorControl
              value={values.color}
              colors={colors ?? []}
              onChange={(color) =>
                setValues((values) => ({
                  ...values,
                  color,
                }))
              }
            />
          </Box>
          <HStack display="flex" alignItems="center" flex="1" gap="2" px="0">
            <Field.Root invalid={!!error}>
              <VisuallyHidden>
                <Field.Label>Name</Field.Label>
              </VisuallyHidden>
              <Input
                ref={inputRef}
                type="text"
                name="tag"
                placeholder="Tag name"
                value={values.name}
                size="sm"
                px="2"
                bg="chakra-body-bg"
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    // prevent modal from closing
                    e.preventDefault();
                    e.stopPropagation();

                    // cancel editing
                  } else if (e.key === "Enter") {
                    // save changes
                    onSave();
                  }
                }}
              />
            </Field.Root>
          </HStack>
          <HStack gap="2">
            <Button variant="ghost" size="sm" onClick={() => onCancel()}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={isLoading}
              onClick={() => onSave()}
            >
              Save
            </Button>
          </HStack>
        </HStack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

interface ManageTagsProps {
  items: Tag[];
  colors?: string[];
  onSave: (tag: Tag) => Promise<void>;
  onCreate: (tag: Pick<Tag, "color" | "name">) => Promise<void>;
  onDelete: (id: Tag["id"]) => Promise<void>;
}

export const ManageTags = (props: ManageTagsProps) => {
  const { items, colors = [], onSave, onCreate, onDelete } = props;

  const addTag = useOpenState({
    defaultOpen: false,
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return items;
    }

    return items.filter((item) => {
      return item.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [items, searchTerm]);

  const noResults = searchTerm && filteredItems.length === 0 && (
    <GridList.Item>
      <GridList.Cell py="2" px="4" textAlign="center">
        No results for &quot;{searchTerm}&quot;
      </GridList.Cell>
    </GridList.Item>
  );

  return (
    <Box>
      <Stack align="left" justify="space-between" dir="column" gap="1" mb="2">
        <Text color="fg.muted" textStyle="sm" mb={2}>
          Use tags to help organize contacts in your workspace. Tags created
          here are available to all users in the workspace.
        </Text>
        <HStack gap="2" justifyContent="space-between">
          <Box>
            <SearchInput
              ref={inputRef}
              size="sm"
              placeholder="Filter by name..."
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
          <Button
            variant="primary"
            colorPalette="indigo"
            onClick={() => {
              setEditId(null);
              addTag.setOpen(true);
            }}
            size="sm"
          >
            New tag
          </Button>
        </HStack>
      </Stack>

      <TagListAddItem
        open={addTag.open}
        colors={colors}
        onSave={async (tag) => {
          const result = await onCreate(tag);
          addTag.setOpen(false);
          return result;
        }}
        onCancel={() => addTag.setOpen(false)}
      />
      <GridList.Root>
        {noResults}
        {filteredItems.map((item) => (
          <TagListItem
            key={item.id}
            colors={colors}
            item={item}
            onEdit={() => {
              setEditId(item.id);
              addTag.setOpen(false);
            }}
            onCancel={() => setEditId(null)}
            onSave={async (tag) => {
              const result = await onSave(tag);
              setEditId(null);
              return result;
            }}
            onDelete={() => onDelete(item.id)}
            isEditing={editId === item.id}
          />
        ))}
      </GridList.Root>
    </Box>
  );
};
