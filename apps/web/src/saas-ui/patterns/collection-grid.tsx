import type { ReactNode } from "react";
import { DataGrid, type DataGridProps } from "@saas-ui-pro/react";
import { Box, Page } from "@saas-ui/react";
import { PageStateView } from "./page-states";

// Adapted from the pinned starter contacts/list/list-page.tsx DataGrid composition.
export function CollectionGrid<Row extends object>({
  actions,
  columns,
  data,
  emptyDescription,
  title,
}: {
  readonly actions?: ReactNode;
  readonly columns: DataGridProps<Row>["columns"];
  readonly data: readonly Row[];
  readonly emptyDescription: string;
  readonly title: string;
}) {
  return (
    <Page.Root>
      <Page.Header actions={actions} title={title} />
      <Page.Body p="0">
        {data.length === 0 ? (
          <Box p={{ base: "4", md: "8" }}>
            <PageStateView
              description={emptyDescription}
              state="empty"
              title={`No ${title.toLocaleLowerCase()} yet`}
            />
          </Box>
        ) : (
          <DataGrid<Row>
            columns={columns}
            data={[...data]}
            isHoverable
            isSortable
          />
        )}
      </Page.Body>
    </Page.Root>
  );
}
