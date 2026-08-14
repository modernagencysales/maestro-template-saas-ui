import { Card, FileUpload, Text } from "@saas-ui/react";

// Adapted from the official Saas UI file-upload registry composition.

function FileUploadPattern({
  accept,
  files,
  onAccept,
}: {
  readonly accept?: string;
  readonly files: readonly File[];
  readonly onAccept: (files: readonly File[]) => void;
}) {
  return (
    <Card.Root>
      <Card.Body>
        <FileUpload.Root
          accept={accept}
          maxFiles={20}
          onFileAccept={({ files: accepted }) => onAccept(accepted)}
        >
          <FileUpload.Dropzone>
            <Text>Drop files here or choose files</Text>
            <FileUpload.Trigger>Choose files</FileUpload.Trigger>
          </FileUpload.Dropzone>
          <FileUpload.List clearable files={[...files]} showSize />
        </FileUpload.Root>
      </Card.Body>
    </Card.Root>
  );
}

export { FileUploadPattern as FileUpload };
