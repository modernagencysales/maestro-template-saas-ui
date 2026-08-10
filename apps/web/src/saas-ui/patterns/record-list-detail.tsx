import { Button, Grid, Stack, Text } from "@saas-ui/react";
import { PageStateView } from "./page-states";

// Adapted from the pinned starter contacts list/detail composition.
export interface ListDetailRecord {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export function RecordListDetail({
  detail,
  onSelect,
  records,
  selectedId,
}: {
  readonly detail?: React.ReactNode;
  readonly onSelect: (id: string) => void;
  readonly records: readonly ListDetailRecord[];
  readonly selectedId?: string;
}) {
  if (records.length === 0) {
    return (
      <PageStateView
        description="Connect a record source to begin."
        state="empty"
        title="No records yet"
      />
    );
  }

  return (
    <Grid
      gap="6"
      templateColumns={{ base: "minmax(0, 1fr)", lg: "18rem minmax(0, 1fr)" }}
    >
      <Stack aria-label="Records" as="nav" gap="2">
        {records.map((record) => (
          <Button
            aria-current={record.id === selectedId ? "page" : undefined}
            justifyContent="flex-start"
            key={record.id}
            onClick={() => onSelect(record.id)}
            variant={record.id === selectedId ? "subtle" : "ghost"}
          >
            <Stack align="start" gap="0" minW="0">
              <Text fontWeight="medium">{record.label}</Text>
              {record.description ? (
                <Text color="fg.muted" fontSize="sm">
                  {record.description}
                </Text>
              ) : null}
            </Stack>
          </Button>
        ))}
      </Stack>
      <Stack minW="0">{detail}</Stack>
    </Grid>
  );
}
