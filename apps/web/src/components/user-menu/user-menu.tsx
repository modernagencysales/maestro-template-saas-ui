import { Stack, Text } from "@chakra-ui/react";

import * as Menu from "@/components/ui/menu/menu";
import * as Persona from "@/components/ui/persona/persona";
import type { PersonaPresence } from "@/components/ui/persona/presence";

export const UserMenu = () => {
  const user = {
    name: "Renata Alink",
    email: "renata@alink.com",
    avatar: "https://saas-ui.dev/showcase-avatar.jpg",
    presence: "online",
  } satisfies {
    name: string;
    email: string;
    avatar: string;
    presence: PersonaPresence;
  };

  return (
    <Menu.Root defaultOpen>
      <Menu.Button>{user.name}</Menu.Button>
      <Menu.Content>
        <Menu.ItemGroup>
          <Menu.Item value="user">
            <Persona.Root size="sm">
              <Persona.Avatar name={user.name} src={user.avatar}>
                <Persona.PresenceBadge />
              </Persona.Avatar>
            </Persona.Root>
            <Stack gap="0">
              <Text>{user.name}</Text>
              <Text fontSize="sm" fontWeight="normal" color="fg.muted">
                {user.email}
              </Text>
            </Stack>
          </Menu.Item>
        </Menu.ItemGroup>
        <Menu.Separator />
        <Menu.ItemGroup>
          <Menu.Item value="profile">Profile</Menu.Item>
          <Menu.Item value="settings">Settings</Menu.Item>
        </Menu.ItemGroup>
        <Menu.Separator />
        <Menu.ItemGroup>
          <Menu.Item value="changelog">Changelog</Menu.Item>
          <Menu.Item value="help">Help</Menu.Item>
          <Menu.Item value="feedback">Feedback</Menu.Item>
        </Menu.ItemGroup>
        <Menu.Separator />
        <Menu.ItemGroup>
          <Menu.Item value="signout">Sign out</Menu.Item>
        </Menu.ItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
};
