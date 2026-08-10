import { Button, Card, HStack, Stack, Text } from "@saas-ui/react";
import type { FileItem } from "./file-card";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 files-list-card.tsx.
export function FilesListCard({
  files,
  onOpen,
}: {
  readonly files: readonly FileItem[];
  readonly onOpen: (id: string) => void;
}) {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Files</Card.Title>
      </Card.Header>
      <Card.Body>
        <Stack gap="3">
          {files.map((file) => (
            <HStack key={file.id}>
              <Text flex="1" overflowWrap="anywhere">
                {file.name}
              </Text>
              <Text color="fg.muted" fontSize="sm">
                {file.sizeLabel}
              </Text>
              <Button onClick={() => onOpen(file.id)} size="sm" variant="ghost">
                Open file
              </Button>
            </HStack>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
