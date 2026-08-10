import { Button, Card, HStack, Icon, Stack, Text } from "@saas-ui/react";
import { FileText } from "lucide-react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 file-cards.tsx.
export interface FileItem {
  readonly id: string;
  readonly name: string;
  readonly sizeLabel?: string;
  readonly modifiedLabel?: string;
}
export function FileCard({
  file,
  onOpen,
  onRemove,
}: {
  readonly file: FileItem;
  readonly onOpen: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) {
  return (
    <Card.Root>
      <Card.Body>
        <HStack>
          <Icon as={FileText} boxSize="6" />
          <Stack flex="1" gap="0" minW="0">
            <Text fontWeight="medium" overflowWrap="anywhere">
              {file.name}
            </Text>
            <Text color="fg.muted" fontSize="sm">
              {[file.sizeLabel, file.modifiedLabel].filter(Boolean).join(" · ")}
            </Text>
          </Stack>
        </HStack>
      </Card.Body>
      <Card.Footer gap="2">
        <Button onClick={() => onOpen(file.id)} size="sm" variant="outline">
          Open file
        </Button>
        <Button onClick={() => onRemove(file.id)} size="sm" variant="ghost">
          Remove file
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
