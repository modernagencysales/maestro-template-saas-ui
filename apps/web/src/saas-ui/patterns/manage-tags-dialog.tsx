import { useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  Field,
  HStack,
  Input,
  Stack,
  Text,
} from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 manage-tags-modal without palette controls.
export interface ManagedTag {
  readonly id: string;
  readonly label: string;
}
export function ManageTagsDialog({
  onAdd,
  onOpenChange,
  onRemove,
  open,
  tags,
}: {
  readonly onAdd: (label: string) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRemove: (id: string) => void;
  readonly open: boolean;
  readonly tags: readonly ManagedTag[];
}) {
  const [label, setLabel] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (label.trim()) {
      onAdd(label.trim());
      setLabel("");
    }
  };
  return (
    <Dialog.Root
      onOpenChange={({ open: next }) => onOpenChange(next)}
      open={open}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Manage tags</Dialog.Title>
          <Dialog.CloseButton />
        </Dialog.Header>
        <Dialog.Body>
          <Stack gap="4">
            <form onSubmit={submit}>
              <Stack direction={{ base: "column", sm: "row" }}>
                <Field.Root>
                  <Field.Label>Tag name</Field.Label>
                  <Input
                    fontSize={{ base: "md", sm: "sm" }}
                    onChange={(event) => setLabel(event.currentTarget.value)}
                    value={label}
                  />
                </Field.Root>
                <Button alignSelf="flex-end" type="submit">
                  Add tag
                </Button>
              </Stack>
            </form>
            {tags.map((tag) => (
              <HStack key={tag.id}>
                <Text flex="1">{tag.label}</Text>
                <Button
                  onClick={() => onRemove(tag.id)}
                  size="sm"
                  variant="ghost"
                >
                  Remove tag
                </Button>
              </HStack>
            ))}
          </Stack>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button>Done</Button>
          </Dialog.ActionTrigger>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
