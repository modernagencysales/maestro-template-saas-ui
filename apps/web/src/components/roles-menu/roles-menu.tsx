import * as React from "react";

import { Box, Text, useControllableState } from "@chakra-ui/react";

import * as Menu from "@/components/ui/menu/menu";

export interface RolesMenuProps {
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export const RolesMenu: React.FC<RolesMenuProps> = (props) => {
  const [role, setRole] = useControllableState({
    defaultValue: props.defaultValue,
    value: props.value,
    onChange: props.onChange,
  });

  const roles = [
    {
      label: "User",
      value: "user",
      description: "Standard access to view and interactive with content.",
    },
    {
      label: "Moderator",
      value: "moderator",
      description: "Abilitity to moderate content and manage users.",
    },
    {
      label: "Admin",
      value: "admin",
      description: "Full access to manage content, users, and settings.",
    },
  ] as const;

  const selectedRole = roles.find((r) => r.value === role) ?? roles[0];

  return (
    <Menu.Root defaultOpen closeOnSelect={false}>
      <Menu.Button>{selectedRole.label}</Menu.Button>
      <Menu.Content maxW="280px">
        <Menu.RadioItemGroup
          title="Roles"
          color="muted"
          fontWeight="medium"
          mt="0"
          value={role}
          onValueChange={({ value }) => setRole(value as string)}
        >
          {roles.map(({ label, value, description }) => (
            <Menu.RadioItem
              key={value}
              value={value}
              position="relative"
              endElement={
                <Box w="4" textStyle="md">
                  <Menu.ItemIndicator />
                </Box>
              }
            >
              <Text textStyle="sm" fontWeight="medium">
                {label}
              </Text>
              <Text textStyle="xs" color="fg.muted">
                {description}
              </Text>
            </Menu.RadioItem>
          ))}
        </Menu.RadioItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
};
