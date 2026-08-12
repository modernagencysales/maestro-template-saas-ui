import { Box, Page } from "@saas-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

import type { ContactDTO } from "@workspace/api/types";
import { DataBoard, type DataBoardProps } from "@workspace/ui/data-board";

import { ContactBoardHeader } from "../contacts/list/contact-board-header";
import { ContactCard } from "../contacts/list/contact-card";
import { useGoldenAdapter } from "./adapters";

type CardDragEnd = NonNullable<DataBoardProps<ContactDTO>["onCardDragEnd"]>;
type CardDragEndEvent = Parameters<CardDragEnd>[0];

const columns: ColumnDef<ContactDTO>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "tags", header: "Tags" },
  { accessorKey: "status", header: "Status" },
];

const visibleColumns = {
  name: true,
  email: true,
  type: true,
  tags: true,
  status: true,
};

function statusFromDrop(event: CardDragEndEvent) {
  const [, status] = String(event.to.columnId).split(":");
  if (status !== "active" && status !== "inactive") {
    throw new Error(`Unsupported contact status: ${status}`);
  }
  return status;
}

function contactIdFromDrop(event: CardDragEndEvent) {
  const contactId = event.items[event.to.columnId]?.[event.to.index];
  if (!contactId) throw new Error("Contact not found");
  return String(contactId);
}

export function GoldenKanbanPage() {
  const adapter = useGoldenAdapter();
  const contacts = useMemo(
    () =>
      adapter.contacts
        .slice(0, 2)
        .map((contact) => ({ ...contact, tags: [...contact.tags] })),
    [adapter.contacts],
  );

  const onCardDragEnd = useCallback(
    (event: CardDragEndEvent) => {
      return adapter.updateContactStatus(
        contactIdFromDrop(event),
        statusFromDrop(event),
      );
    },
    [adapter],
  );

  return (
    <Page.Root>
      <Page.Header title="Contacts" />
      <Page.Body p="0" height="full">
        <Box height="100%" width="100%" bg="page-body-bg-subtle">
          <DataBoard<ContactDTO>
            height="100%"
            px="6"
            columns={columns}
            data={contacts}
            renderHeader={(header) => <ContactBoardHeader {...header} />}
            renderCard={(row) => <ContactCard contact={row.original} />}
            groupBy="status"
            onCardDragEnd={onCardDragEnd}
            getRowId={(row) => row.id}
            state={{ columnVisibility: visibleColumns }}
          />
        </Box>
      </Page.Body>
    </Page.Root>
  );
}
