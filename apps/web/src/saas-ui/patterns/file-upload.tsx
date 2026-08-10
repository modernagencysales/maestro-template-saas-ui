import { useRef, type ChangeEvent } from "react";
import { Button, Card, HStack, Stack, Text } from "@saas-ui/react";

// Adapted from chakra-ui/chakra-ui@c8ef4fb3146ecb82521a878eb6545b4c9598abd6 file-upload composition.
export function FileUpload({
  accept,
  files,
  onAccept,
  onRemove,
}: {
  readonly accept?: string;
  readonly files: readonly File[];
  readonly onAccept: (files: readonly File[]) => void;
  readonly onRemove: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onAccept(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };
  return (
    <Card.Root>
      <Card.Body gap="4">
        <input
          accept={accept}
          aria-label="Choose files"
          hidden
          multiple
          onChange={acceptFiles}
          ref={inputRef}
          type="file"
        />
        <Button
          alignSelf="flex-start"
          onClick={() => inputRef.current?.click()}
          variant="outline"
        >
          Choose files
        </Button>
        <Stack aria-live="polite" gap="2">
          {files.map((file) => (
            <HStack key={`${file.name}-${file.lastModified}`}>
              <Text flex="1" overflowWrap="anywhere">
                {file.name}
              </Text>
              <Button onClick={() => onRemove(file)} size="sm" variant="ghost">
                Remove file
              </Button>
            </HStack>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
