import * as React from "react";

import { Dialog } from "@saas-ui/react";

import { type FieldOptions, Form, useAppForm } from "../form";

export interface InviteData {
  emails: string[];
  role?: "admin" | "member" | string;
}

interface InviteInputs {
  emails: string;
  role?: "admin" | "member" | string;
}

export interface InviteDialogProps extends Omit<
  Dialog.RootProps,
  "onSubmit" | "title" | "scrollBehavior" | "children"
> {
  title?: string;
  onInvite(data: InviteData): Promise<any>;
  roles?: FieldOptions;
  requiredLabel?: string;
  placeholder?: string;
  onError?: (error: any) => void;
  defaultValues?: InviteInputs;
}

export const defaultMemberRoles = [
  {
    value: "admin",
    label: "Admin",
  },
  {
    value: "member",
    label: "Member",
  },
];

export function InviteDialog(props: InviteDialogProps) {
  const {
    onOpenChange,
    onInvite,
    onError,
    roles,
    defaultValues,
    title = "Invite people",
    placeholder = "example@company.com, example2@company.com",
    requiredLabel = "Add at least one email address.",
    ...rest
  } = props;

  const fieldRef = React.useRef<HTMLTextAreaElement>(null);

  const form = useAppForm({
    defaultValues: {
      emails: "",
      role: "member",
      ...defaultValues,
    },
    onSubmit: async ({ value }) => {
      try {
        await onInvite?.({
          emails: value.emails.split(",").map((email: string) => email.trim()),
          role: value.role,
        });

        onOpenChange?.({
          open: false,
        });
      } catch (e: any) {
        onError?.(e);
      }
    },
  });

  const roleOptions = roles || defaultMemberRoles;

  return (
    <Dialog.Root
      {...rest}
      onOpenChange={onOpenChange}
      initialFocusEl={() => fieldRef.current}
    >
      <Dialog.Content portalled>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.CloseButton />
          </Dialog.Header>
          <Dialog.Body>
            <form.Layout>
              <form.AppField
                name="emails"
                validators={{
                  onChange: ({ value }: { value: string }) =>
                    !value ? requiredLabel : undefined,
                }}
              >
                {(field) => (
                  <field.TextareaField
                    placeholder={placeholder}
                    ref={fieldRef}
                  />
                )}
              </form.AppField>
              <form.AppField name="role">
                {(field) => (
                  <field.SelectField label="Role" options={roleOptions} />
                )}
              </form.AppField>
            </form.Layout>
          </Dialog.Body>
          <Dialog.Footer>
            <form.SubmitButton>Invite</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
