import { Button, HStack, Input, Text } from "@saas-ui/react";

// Adapted from the pinned starter contacts/list/contact-filters.tsx toolbar.
export function DataFilters({
  count,
  onClear,
  onQueryChange,
  query,
}: {
  readonly count: number;
  readonly onClear: () => void;
  readonly onQueryChange: (query: string) => void;
  readonly query: string;
}) {
  return (
    <HStack align="center" flexWrap="wrap" gap="3" role="search">
      <Input
        aria-label="Filter records"
        fontSize={{ base: "md", sm: "sm" }}
        maxW="sm"
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="Filter by name or email"
        value={query}
      />
      <Text color="fg.muted" fontSize="sm" role="status">
        {new Intl.NumberFormat().format(count)} results
      </Text>
      {query ? (
        <Button onClick={onClear} size="sm" variant="ghost">
          Clear filters
        </Button>
      ) : null}
    </HStack>
  );
}
