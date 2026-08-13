import { createFileRoute } from "@tanstack/react-router";
import { Button, Page, SimpleGrid, Stack } from "@saas-ui/react";
import * as React from "react";

import { AddContactDrawer } from "#components/add-contact-drawer/add-contact-drawer";
import { ChatDetails } from "#components/chat-details/chat-details";
import { FeedbackModal } from "#components/feedback-modal/feedback-modal";
import { FileCards } from "#components/file-cards/file-cards";
import { FilesList } from "#components/files-list-card/files-list-card";
import { LatestMessagesCard } from "#components/latest-messages-card/latest-messages-card";

export const Route = createFileRoute("/_app/$workspace/_dashboard/showcase")({
  head: () => ({ meta: [{ title: "Pro surfaces" }] }),
  component: ShowcasePage,
});
const files = [
  {
    name: "Launch brief.pdf",
    type: "pdf",
    size: "2.4 MB",
    modifiedAt: "Today",
  },
  {
    name: "Workspace map.png",
    type: "image",
    size: "1.1 MB",
    modifiedAt: "Yesterday",
  },
];
const messageDate = "2026-01-01T12:00:00.000Z";

function ShowcasePage() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  return (
    <Page.Root height="100%">
      <Page.Header
        title="Pro surfaces"
        description="Communication, files, drawers, and dialogs."
      />
      <Page.Body>
        <Stack gap="6">
          <Stack direction="row" gap="3">
            <Button onClick={() => setDrawerOpen(true)}>Add contact</Button>
            <Button onClick={() => setModalOpen(true)}>Send feedback</Button>
          </Stack>
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6">
            <LatestMessagesCard
              items={[
                {
                  name: "Alex Morgan",
                  avatar: "",
                  date: "Now",
                  message: "Ready for review",
                  presence: "online",
                  unread: true,
                },
              ]}
            />
            <FilesList files={files} />
          </SimpleGrid>
          <FileCards files={files.map((file) => ({ ...file, icon: null }))} />
          <ChatDetails
            currentUser={{ id: "user-1", name: "You" }}
            chat={{
              contact: { name: "Alex Morgan", email: "alex@example.com" },
              items: [
                { type: "divider", date: messageDate },
                {
                  id: "message-1",
                  type: "inbound-message",
                  date: messageDate,
                  from: { id: "user-2", type: "user", name: "Alex Morgan" },
                  message: "Welcome to the workspace.",
                },
              ],
            }}
          />
        </Stack>
        {drawerOpen ? (
          <AddContactDrawer
            open
            onOpenChange={(details: { open: boolean }) =>
              setDrawerOpen(details.open)
            }
            onSubmit={() => setDrawerOpen(false)}
          />
        ) : null}
        <FeedbackModal
          open={modalOpen}
          onOpenChange={(details: { open: boolean }) =>
            setModalOpen(details.open)
          }
          onSubmit={() => setModalOpen(false)}
        />
      </Page.Body>
    </Page.Root>
  );
}
