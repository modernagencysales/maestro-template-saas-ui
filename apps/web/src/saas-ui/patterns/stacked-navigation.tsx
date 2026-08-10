import { Link, Stack } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 navbar-tabs.tsx.
export function StackedNavigation({
  items,
}: {
  readonly items: readonly {
    readonly href: string;
    readonly label: string;
    readonly active?: boolean;
  }[];
}) {
  return (
    <Stack
      aria-label="Section navigation"
      as="nav"
      direction="row"
      flexWrap="wrap"
      gap="2"
    >
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          href={item.href}
          key={item.href}
          px="3"
          py="2"
          textDecoration={item.active ? "underline" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </Stack>
  );
}
