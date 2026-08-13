import { Card, FileUpload, Text } from "@saas-ui/react";

// Adapted from the official Saas UI file-upload registry composition.

function FileUploadPattern({
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
  return (
    <Card.Root>
      <Card.Body>
        <FileUpload.Root
          accept={accept}
          acceptedFiles={[...files]}
          maxFiles={20}
          onFileAccept={({ files: accepted }) => onAccept(accepted)}
        >
          <FileUpload.Dropzone>
            <Text>Drop files here or choose files</Text>
            <FileUpload.Trigger>Choose files</FileUpload.Trigger>
          </FileUpload.Dropzone>
          <FileUpload.ItemGroup>
            {files.map((file) => (
              <FileUpload.Item
                file={file}
                key={`${file.name}-${file.lastModified}`}
              >
                <FileUpload.ItemName />
                <FileUpload.ItemSizeText />
                <FileUpload.ItemDeleteTrigger
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(file)}
                />
              </FileUpload.Item>
            ))}
          </FileUpload.ItemGroup>
        </FileUpload.Root>
      </Card.Body>
    </Card.Root>
  );
}

export { FileUploadPattern as FileUpload };
