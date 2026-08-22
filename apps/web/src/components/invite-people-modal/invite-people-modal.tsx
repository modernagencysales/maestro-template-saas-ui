import * as React from "react";

import { z } from "zod";

import * as Dialog from "@/components/ui/dialog/dialog";
import { Form, useAppForm } from "@/components/forms/index";
import { Button } from "@/components/ui/button/button";

const schema = z.object({
  emails: z
    .string()
    .transform((value) => value.split(/[\n,;]/).filter(Boolean))
    .pipe(z.array(z.string().email())),
  role: z.string(),
});

type InvitePeopleInput = z.infer<typeof schema>;

interface InvitePeopleModalProps extends Pick<
  Dialog.RootProps,
  "open" | "onOpenChange"
> {
  onSubmit: (data: InvitePeopleInput) => Promise<void>;
}

export const InvitePeopleModal: React.FC<InvitePeopleModalProps> = (props) => {
  const { onSubmit, ...modalProps } = props;

  const roleOptions = [
    {
      value: "member",
      label: "Member",
    },
    {
      value: "admin",
      label: "Admin",
    },
  ];

  const form = useAppForm({
    validators: { onSubmit: schema },
    defaultValues: {
      emails: "",
      role: "member",
    },
    onSubmit: ({ value }) => {
      const data = schema.parse(value);
      console.log(data);
      void onSubmit(data);
    },
  });

  return (
    <Dialog.Root {...modalProps}>
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>Invite people</Dialog.Title>

            <Dialog.CloseButton />
          </Dialog.Header>
          <Dialog.Body pb="4">
            <form.Layout>
              <form.AppField name="emails">
                {(field) => (
                  <field.TextareaField
                    label="Email"
                    placeholder="Enter emails separated by commas or new lines"
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
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.CloseTrigger>
            <form.SubmitButton>Invite</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  );
};
