import * as React from "react";

import { Field, HStack } from "@chakra-ui/react";

import * as Drawer from "@/components/ui/drawer/drawer";
import * as FileUpload from "@/components/ui/file-upload/file-upload";
import { Form, useAppForm } from "@/components/forms/index";
import { Avatar } from "@/components/ui/avatar/avatar";
import { Button } from "@/components/ui/button/button";

export interface AddContactFormValues {
  profileImage: File | null;
  name: string;
  email: string;
  company: string;
  about: string;
  type: "lead" | "customer";
}

export interface AddContactDrawerProps extends Omit<
  Drawer.RootProps,
  "children"
> {
  open?: boolean;
  onOpenChange?: (details: { open: boolean }) => void;
  onSubmit: (values: AddContactFormValues) => Promise<void> | void;
}

export const AddContactDrawer: React.FC<AddContactDrawerProps> = (props) => {
  const { onSubmit, open, onOpenChange, ...rest } = props;

  const defaultValues: AddContactFormValues = {
    profileImage: null,
    name: "",
    email: "",
    company: "",
    about: "",
    type: "lead",
  };
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <Drawer.Root
      {...(rest as Drawer.RootProps)}
      {...({ open, onOpenChange } as Drawer.RootProps)}
    >
      <Drawer.Backdrop />
      <Form form={form}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Add contact</Drawer.Title>
            <Drawer.CloseButton />
          </Drawer.Header>

          <Drawer.Body>
            <form.Layout>
              <form.AppField name="profileImage">
                {(field) => (
                  <Field.Root>
                    <Field.Label>Photo</Field.Label>
                    <FileUpload.Root
                      maxFileSize={1024 * 1024}
                      accept="image/*"
                      maxFiles={1}
                      name={field.name}
                      acceptedFiles={
                        field.state.value ? [field.state.value] : []
                      }
                      onFileAccept={(details) => {
                        const file = details.files?.[0];
                        if (file) field.handleChange(file);
                      }}
                    >
                      <FileUpload.Dropzone>
                        <HStack gap="4">
                          <Avatar size="sm" />
                          <FileUpload.Trigger asChild>
                            <Button>Upload</Button>
                          </FileUpload.Trigger>
                        </HStack>
                      </FileUpload.Dropzone>
                    </FileUpload.Root>
                  </Field.Root>
                )}
              </form.AppField>
              <form.AppField name="name">
                {(field) => <field.TextField label="Name" required />}
              </form.AppField>
              <form.AppField name="email">
                {(field) => (
                  <field.TextField
                    label="Email address"
                    type="email"
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="company">
                {(field) => <field.TextField label="Company" />}
              </form.AppField>
              <form.AppField name="about">
                {(field) => (
                  <field.TextareaField label="About" help="Max 100 words." />
                )}
              </form.AppField>
              <form.AppField name="type">
                {(field) => (
                  <field.SelectField
                    label="Type"
                    options={[
                      { label: "Lead", value: "lead" },
                      { label: "Customer", value: "customer" },
                    ]}
                  />
                )}
              </form.AppField>
            </form.Layout>
          </Drawer.Body>

          <Drawer.Footer alignItems="flex-end">
            <Drawer.CloseTrigger asChild>
              <Button>Cancel</Button>
            </Drawer.CloseTrigger>
            {React.createElement(form.SubmitButton, undefined, "Create")}
          </Drawer.Footer>
        </Drawer.Content>
      </Form>
    </Drawer.Root>
  );
};
