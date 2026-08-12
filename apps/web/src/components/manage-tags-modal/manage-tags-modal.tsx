import { Box } from "@chakra-ui/react";

import * as Dialog from "@/components/ui/dialog/dialog";

import { ManageTags, type ManageTagsProps } from "./manage-tags";

export interface ManageTagsModalProps
  extends Omit<Dialog.RootProps, "children">, ManageTagsProps {}

export function ManageTagsModal(props: ManageTagsModalProps) {
  const { colors, items, onSave, onCreate, onDelete, ...dialogProps } = props;

  return (
    <Dialog.Root {...dialogProps}>
      <Dialog.Content>
        <Dialog.Header>
          <Box>
            <Dialog.Title>Manage Tags</Dialog.Title>
            <Dialog.Description>
              Use tags to help organize contacts in your workspace.
            </Dialog.Description>
          </Box>
          <Dialog.CloseButton />
        </Dialog.Header>
        <Dialog.Body>
          <ManageTags
            colors={colors}
            items={items}
            onSave={onSave}
            onCreate={onCreate}
            onDelete={onDelete}
          />
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
