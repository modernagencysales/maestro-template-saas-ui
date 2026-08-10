import { useState, type FormEvent } from "react";
import { Button, Drawer, Field, Input, Stack, Textarea } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 add-contact-drawer.tsx.
export interface ContactInput {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly about: string;
}
export function AddContactDrawer({
  onOpenChange,
  onSubmit,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (contact: ContactInput) => void | Promise<void>;
  readonly open: boolean;
}) {
  const [contact, setContact] = useState<ContactInput>({
    name: "",
    email: "",
    company: "",
    about: "",
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(contact);
  };
  return (
    <Drawer.Root
      onOpenChange={({ open: next }) => onOpenChange(next)}
      open={open}
    >
      <Drawer.Backdrop />
      <Drawer.Content>
        <form onSubmit={submit}>
          <Drawer.Header>
            <Drawer.Title>Add contact</Drawer.Title>
            <Drawer.CloseButton />
          </Drawer.Header>
          <Drawer.Body>
            <Stack gap="4">
              <Field.Root required>
                <Field.Label>Name</Field.Label>
                <Input
                  autoComplete="name"
                  fontSize={{ base: "md", sm: "sm" }}
                  onChange={(event) =>
                    setContact({ ...contact, name: event.currentTarget.value })
                  }
                  value={contact.name}
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label>Email address</Field.Label>
                <Input
                  autoComplete="email"
                  fontSize={{ base: "md", sm: "sm" }}
                  onChange={(event) =>
                    setContact({ ...contact, email: event.currentTarget.value })
                  }
                  type="email"
                  value={contact.email}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Company</Field.Label>
                <Input
                  autoComplete="organization"
                  fontSize={{ base: "md", sm: "sm" }}
                  onChange={(event) =>
                    setContact({
                      ...contact,
                      company: event.currentTarget.value,
                    })
                  }
                  value={contact.company}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>About</Field.Label>
                <Textarea
                  onChange={(event) =>
                    setContact({ ...contact, about: event.currentTarget.value })
                  }
                  value={contact.about}
                />
              </Field.Root>
            </Stack>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.CloseTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Drawer.CloseTrigger>
            <Button type="submit">Create contact</Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer.Root>
  );
}
