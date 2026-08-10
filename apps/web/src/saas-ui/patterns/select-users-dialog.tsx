import { Button, Dialog, Stack, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 select-users-modal.tsx.
export interface UserOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}
export function SelectUsersDialog({
  onChange,
  onOpenChange,
  onSubmit,
  open,
  options,
  selectedIds,
}: {
  readonly onChange: (ids: readonly string[]) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: () => void;
  readonly open: boolean;
  readonly options: readonly UserOption[];
  readonly selectedIds: readonly string[];
}) {
  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
  return (
    <Dialog.Root
      onOpenChange={({ open: next }) => onOpenChange(next)}
      open={open}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Select users</Dialog.Title>
          <Dialog.CloseButton />
        </Dialog.Header>
        <Dialog.Body>
          <Stack gap="2">
            {options.map((option) => (
              <Button
                aria-pressed={selectedIds.includes(option.id)}
                justifyContent="flex-start"
                key={option.id}
                onClick={() => toggle(option.id)}
                variant={selectedIds.includes(option.id) ? "subtle" : "ghost"}
              >
                <Stack align="start" gap="0">
                  <Text>{option.label}</Text>
                  {option.description ? (
                    <Text color="fg.muted" fontSize="sm">
                      {option.description}
                    </Text>
                  ) : null}
                </Stack>
              </Button>
            ))}
          </Stack>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button variant="ghost">Cancel</Button>
          </Dialog.ActionTrigger>
          <Button onClick={onSubmit}>Select users</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
