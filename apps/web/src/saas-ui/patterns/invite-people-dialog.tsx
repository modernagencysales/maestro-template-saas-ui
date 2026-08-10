import { useState, type FormEvent } from "react";
import { Button, Dialog, Field, Input, Stack, Textarea } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 invite-people-modal.tsx.
export interface InvitePeopleInput {
  readonly emails: readonly string[];
  readonly role: string;
}
export function InvitePeopleDialog({
  onOpenChange,
  onSubmit,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: InvitePeopleInput) => void | Promise<void>;
  readonly open: boolean;
}) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("member");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit({
      emails: emails
        .split(/[\n,;]/u)
        .map((email) => email.trim())
        .filter(Boolean),
      role,
    });
  };
  return (
    <Dialog.Root
      onOpenChange={({ open: next }) => onOpenChange(next)}
      open={open}
    >
      <Dialog.Content>
        <form onSubmit={submit}>
          <Dialog.Header>
            <Dialog.Title>Invite people</Dialog.Title>
            <Dialog.CloseButton />
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Field.Root required>
                <Field.Label>Email addresses</Field.Label>
                <Textarea
                  onChange={(event) => setEmails(event.currentTarget.value)}
                  placeholder="name@example.com"
                  value={emails}
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label>Role</Field.Label>
                <Input
                  fontSize={{ base: "md", sm: "sm" }}
                  onChange={(event) => setRole(event.currentTarget.value)}
                  value={role}
                />
              </Field.Root>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.ActionTrigger>
            <Button type="submit">Send invitations</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
