import { Box, Page } from "@saas-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import type { ContactDTO } from "@workspace/api/types";
import { DataBoard } from "@workspace/ui/data-board";

import { ContactBoardHeader } from "../contacts/list/contact-board-header";
import { ContactCard } from "../contacts/list/contact-card";
import { useGoldenAdapter } from "./adapters";

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

export function GoldenKanbanPage() {
  const adapter = useGoldenAdapter();
  const contacts = useMemo(
    () =>
      adapter.contacts
        .slice(0, 2)
        .map((contact) => ({ ...contact, tags: [...contact.tags] })),
    [adapter.contacts],
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
            getRowId={(row) => row.id}
            state={{ columnVisibility: visibleColumns }}
          />
        </Box>
      </Page.Body>
    </Page.Root>
  );
}
