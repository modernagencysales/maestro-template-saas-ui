"use client";

import * as React from "react";

import { ToggleGroup } from "@ark-ui/react";
import {
  Box,
  ButtonGroup,
  HStack,
  Link,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  LuCircleHelp,
  LuMessageCircle,
  LuPaperclip,
  LuTriangleAlert,
} from "react-icons/lu";

import * as Dialog from "@/components/ui/dialog/dialog";
import * as FileUpload from "@/components/ui/file-upload/file-upload";
import { Form, useAppForm } from "@/components/forms/index";
import { Button } from "@/components/ui/button/button";

export interface FeedbackInput {
  type: "problem" | "question" | "feedback";
  comment: string;
  files: File[];
}

export interface FeedbackModalProps extends Omit<Dialog.RootProps, "children"> {
  onSubmit: (data: FeedbackInput) => Promise<void> | void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = (props) => {
  const { onSubmit, ...rest } = props;

  const defaultValues: FeedbackInput = {
    type: "feedback",
    comment: "",
    files: [],
  };
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <Dialog.Root size="lg" {...rest}>
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Box>
              <Dialog.Title>Feedback</Dialog.Title>
              <Dialog.Description>
                Got feedback? Share your feature requests and why they're
                important.
              </Dialog.Description>
            </Box>
            <Dialog.CloseButton />
          </Dialog.Header>
          <Dialog.Body>
            <form.Layout>
              <form.AppField name="type">
                {(field) => (
                  <ToggleButtonField
                    value={field.state.value}
                    onChange={field.handleChange}
                    items={[
                      {
                        value: "feedback",
                        label: "Feedback",
                        icon: <LuMessageCircle />,
                      },
                      {
                        value: "problem",
                        label: "Problem",
                        icon: <LuTriangleAlert />,
                      },
                      {
                        value: "question",
                        label: "Question",
                        icon: <LuCircleHelp />,
                      },
                    ]}
                  />
                )}
              </form.AppField>
              <form.AppField name="comment">
                {(field) => (
                  <Textarea
                    border="0"
                    height="120px"
                    placeholder="What if..."
                    p="0"
                    _focus={{
                      boxShadow: "none",
                      border: 0,
                    }}
                    _focusVisible={{
                      boxShadow: "none",
                      border: 0,
                    }}
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.currentTarget.value)
                    }
                    onBlur={field.handleBlur}
                  />
                )}
              </form.AppField>

              <form.AppField name="files">
                {(field) => (
                  <UploadField
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.AppField>
            </form.Layout>
          </Dialog.Body>
          <Dialog.Footer gap="4" borderTopWidth="1px">
            <Text textStyle="sm" color="fg.muted">
              Email us at{" "}
              <Link href="mailto:hello@saas-ui.dev" color="fg">
                hello@saas-ui.dev
              </Link>
              . We're committed to reading all messages, even if we can't
              respond to every single one.
            </Text>
            <form.SubmitButton flexShrink="0">Send feedback</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

interface ToggleButtonFieldProps extends Omit<
  ToggleGroup.RootProps,
  "multiple" | "onChange" | "onValueChange" | "value"
> {
  items: {
    value: FeedbackInput["type"];
    label: string;
    icon: React.ReactElement;
  }[];
  value?: FeedbackInput["type"];
  onChange?: (value: FeedbackInput["type"]) => void;
}

const ToggleButtonField = (props: ToggleButtonFieldProps) => {
  const { items, value, onChange, ...rest } = props;

  return (
    <ToggleGroup.Root
      value={value ? [value] : []}
      onValueChange={({ value }) => {
        const nextValue = value[0];
        if (
          nextValue === "problem" ||
          nextValue === "question" ||
          nextValue === "feedback"
        ) {
          onChange?.(nextValue);
        }
      }}
      multiple={false}
      asChild
    >
      <ButtonGroup attached={false} {...rest}>
        {items.map((item) => (
          <ToggleGroup.Item key={item.value} value={item.value} asChild>
            <Button
              variant="outline"
              size="sm"
              _checked={{
                borderColor: "accent.solid",
                bg: "accent.muted",
                color: "accent.solid",
              }}
            >
              {item.icon}
              {item.label}
            </Button>
          </ToggleGroup.Item>
        ))}
      </ButtonGroup>
    </ToggleGroup.Root>
  );
};

interface UploadFieldProps extends Omit<
  FileUpload.RootProps,
  "acceptedFiles" | "onChange" | "onFileChange"
> {
  value?: File[];
  onChange?: (files: File[]) => void;
}

const UploadField = (props: UploadFieldProps) => {
  const { value, onChange, maxFiles = 10, ...rest } = props;

  const files = value ?? [];

  return (
    <FileUpload.Root
      maxFileSize={1024 * 1024}
      maxFiles={maxFiles}
      acceptedFiles={files}
      {...rest}
      onFileChange={(details) => {
        onChange?.(details.acceptedFiles);
      }}
    >
      <FileUpload.Dropzone
        width="full"
        bg="none"
        border="0"
        alignItems="start"
        p="0"
      >
        {files.length < maxFiles ? (
          <FileUpload.Trigger>
            <HStack>
              <LuPaperclip /> <Text>Attach images, files or videos.</Text>
            </HStack>
          </FileUpload.Trigger>
        ) : null}

        <FileUpload.List />
      </FileUpload.Dropzone>
    </FileUpload.Root>
  );
};
