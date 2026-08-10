import { Button, Menu } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 roles-menu.tsx.
export interface RoleOption {
  readonly id: string;
  readonly label: string;
}
export function RolesMenu({
  onSelect,
  roles,
  value,
}: {
  readonly onSelect: (id: string) => void;
  readonly roles: readonly RoleOption[];
  readonly value?: string;
}) {
  const selected = roles.find((role) => role.id === value);
  return (
    <Menu.Root>
      <Menu.Button asChild>
        <Button variant="outline">{selected?.label ?? "Choose role"}</Button>
      </Menu.Button>
      <Menu.Content>
        {roles.map((role) => (
          <Menu.Item
            key={role.id}
            onClick={() => onSelect(role.id)}
            value={role.id}
          >
            {role.label}
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu.Root>
  );
}
