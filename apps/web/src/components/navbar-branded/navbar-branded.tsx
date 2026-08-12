import { SaasUIIcon } from "@saas-ui/assets";
import { LuBell } from "react-icons/lu";

import * as Menu from "@/components/ui/menu/menu";
import * as Navbar from "@/components/ui/navbar/navbar";
import * as Persona from "@/components/ui/persona/persona";
import { AppShell } from "@/components/ui/app-shell/app-shell";
import { IconButton } from "@/components/ui/icon-button/icon-button";

export const NavbarBranded: React.FC<React.PropsWithChildren> = (props) => {
  return (
    <AppShell
      height="480px"
      header={
        <Navbar.Root position="sticky" variant="solid" colorPalette="primary">
          <Navbar.Brand>
            <SaasUIIcon width="24px" color="currentColor" />
          </Navbar.Brand>
          <Navbar.Content display={{ base: "hidden", sm: "flex" }}>
            <Navbar.Item>
              <Navbar.Link href="#">Inbox</Navbar.Link>
            </Navbar.Item>
            <Navbar.Item>
              <Navbar.Link active href="#">
                Contacts
              </Navbar.Link>
            </Navbar.Item>
            <Navbar.Item>
              <Navbar.Link href="#">Tasks</Navbar.Link>
            </Navbar.Item>
          </Navbar.Content>
          <Navbar.Content justifyContent="end" gap="2">
            <Navbar.Item>
              <Navbar.Link href="#">Help</Navbar.Link>
            </Navbar.Item>
            <Navbar.Item>
              <IconButton
                variant="outline"
                rounded="full"
                aria-label="Notifications"
                size="xs"
                color="inherit"
                borderColor="currentColor"
                _hover={{
                  bgColor: "whiteAlpha.200",
                }}
                _active={{
                  bgColor: "whiteAlpha.300",
                }}
              >
                <LuBell size="1.2em" />
              </IconButton>
            </Navbar.Item>
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Open user menu"
                  variant="ghost"
                  rounded="full"
                  size="xs"
                >
                  <Persona.Root size="xs" presence="online">
                    <Persona.Avatar src="/showcase-avatar.jpg">
                      <Persona.PresenceBadge />
                    </Persona.Avatar>
                  </Persona.Root>
                </IconButton>
              </Menu.Trigger>
              <Menu.Content color="fg">
                <Menu.ItemGroup title="beatriz@saas-ui.dev">
                  <Menu.Item value="profile">Profile</Menu.Item>
                  <Menu.Item value="settings">Settings</Menu.Item>
                  <Menu.Item value="help">Help &amp; feedback</Menu.Item>
                </Menu.ItemGroup>
                <Menu.Separator />
                <Menu.Item value="logout">Log out</Menu.Item>
              </Menu.Content>
            </Menu.Root>
          </Navbar.Content>
        </Navbar.Root>
      }
    >
      {props.children}
    </AppShell>
  );
};
