import { Link } from "@tanstack/react-router";
import { Menu, Text } from "@saas-ui/react";
import { AppearanceMenu } from "../appearance-menu";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/common/components/user-menu.tsx. Authentication and the
// real user identity remain owned by WorkOS, so no fabricated user is rendered.
export function UserMenu() {
  return (
    <Menu.Root>
      <Menu.Button aria-label="Open user menu" variant="ghost">
        <Text>Account</Text>
      </Menu.Button>
      <Menu.Content>
        <Menu.Item asChild value="settings">
          <Link to="/settings">Settings</Link>
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item asChild value="appearance">
          <AppearanceMenu />
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}
