import * as React from "react";

import {
  Badge,
  Box,
  Collapsible,
  HStack,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { SaasUIIcon } from "@saas-ui/assets";
import {
  LuBell,
  LuChevronsUpDown,
  LuContact,
  LuHeartHandshake,
  LuLightbulb,
  LuListChecks,
  LuMenu,
  LuPlus,
  LuSettings,
  LuUsers,
} from "react-icons/lu";

import * as GridList from "@/components/ui/grid-list/grid-list";
import * as Menu from "@/components/ui/menu/menu";
import * as Navbar from "@/components/ui/navbar/navbar";
import * as Persona from "@/components/ui/persona/persona";
import * as Popover from "@/components/ui/popover/popover";
import * as Sidebar from "@/components/ui/sidebar/sidebar";
import { AppShell } from "@/components/ui/app-shell/app-shell";
import { AvatarGroup } from "@/components/ui/avatar/avatar";
import { Button } from "@/components/ui/button/button";
import { IconBadge } from "@/components/ui/icon-badge/icon-badge";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { SearchInput } from "@/components/ui/search-input/search-input";
import { Status } from "@/components/ui/status/status";

const tags = [
  {
    id: "lead",
    name: "Lead",
    count: 83,
    color: "purple.500",
  },
  {
    id: "customer",
    name: "Customer",
    count: 210,
    color: "green.500",
  },
  {
    id: "partner",
    name: "Partner",
    count: 12,
    color: "blue.500",
  },
  {
    id: "prospect",
    name: "Prospect",
    count: 0,
  },
];

const OrganizationMenu = () => {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          variant="ghost"
          justifyContent="flex-start"
          colorPalette="gray"
          w="full"
          h="10"
          px="2"
        >
          <IconBadge
            icon={<SaasUIIcon width="16px" color="white" />}
            variant="solid"
            bg="black"
            boxSize="7"
          />
          Acme Corp
          <LuChevronsUpDown size="1em" />
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item value="acme-corp">
          <IconBadge
            icon={<SaasUIIcon width="12px" color="white" />}
            variant="solid"
            bg="black"
            boxSize="6"
          />{" "}
          Acme Corp
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item value="create-workspace">Create workspace</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
};

export const Sidebar3 = (props: React.PropsWithChildren) => {
  const isMobile = useBreakpointValue({ base: true, lg: false });

  return (
    <Sidebar.Provider>
      <AppShell
        height="600px"
        bg="bg"
        header={
          <Navbar.Root
            borderBottomWidth="1px"
            justifyContent="start"
            alignItems="start"
          >
            <Navbar.Content gap="4">
              {!isMobile && (
                // <Navbar.Item width="254px" ms="-3">
                <Box width="254px" ms="-3">
                  <OrganizationMenu />
                </Box>
                // </Navbar.Item>
              )}
              {isMobile && (
                <Sidebar.Trigger asChild>
                  <IconButton aria-label="Open sidebar" variant="ghost">
                    <LuMenu />
                  </IconButton>
                </Sidebar.Trigger>
              )}
              <Box flex="1">
                <SearchInput
                  size="sm"
                  variant="subtle"
                  bg="gray.100"
                  _dark={{ bg: "whiteAlpha.100" }}
                />
              </Box>

              <Navbar.ItemGroup justifyContent="end" gap={{ base: 1, lg: 3 }}>
                <Navbar.Item>
                  <AvatarGroup>
                    <Persona.Root size="sm">
                      <Persona.Avatar src="/img/avatars/1.png" name="Beatriz">
                        <Persona.PresenceBadge />
                      </Persona.Avatar>
                    </Persona.Root>
                    <Persona.Root size="sm">
                      <Persona.Avatar src="/img/avatars/2.png" name="Eelco" />
                      <Persona.PresenceBadge />
                    </Persona.Root>
                    <Persona.Root size="sm">
                      <Persona.Avatar src="/img/avatars/3.png" name="Tomasz" />
                      <Persona.PresenceBadge />
                    </Persona.Root>
                  </AvatarGroup>
                </Navbar.Item>
                <Navbar.Item>
                  <Popover.Root size="sm">
                    <Popover.Trigger asChild>
                      <IconButton
                        aria-label="Notifications"
                        variant="ghost"
                        rounded="full"
                        display="flex"
                        position="relative"
                        px="2"
                      >
                        <LuBell size="1.2em" />
                        <Status
                          position="absolute"
                          top="4px"
                          right="4px"
                          borderRadius="full"
                          boxSize="2"
                          colorPalette="orange"
                        />
                      </IconButton>
                    </Popover.Trigger>
                    <Popover.Content>
                      <Popover.Header display="flex" alignItems="center">
                        <Text>Notifications</Text>
                        <Button size="xs" ml="auto">
                          Mark all read
                        </Button>
                      </Popover.Header>
                      <Popover.Body p="0">
                        <GridList.Root px="2" interactive variant="rounded">
                          <GridList.Item onClick={() => null}>
                            <GridList.Cell width="4">
                              <Status
                                colorPalette="accent"
                                borderRadius="full"
                                boxSize="2"
                              />
                            </GridList.Cell>
                            <GridList.Cell flex="1">
                              <Text fontWeight="medium" fontSize="md">
                                Email address is missing
                              </Text>
                              <HStack
                                fontSize="xs"
                                justifyContent="space-between"
                              >
                                <Text color="fg.muted" lineClamp={1}>
                                  New comment from Eelco
                                </Text>
                                <Text color="fg.muted">2h ago</Text>
                              </HStack>
                            </GridList.Cell>
                          </GridList.Item>
                          <GridList.Item onClick={() => null}>
                            <GridList.Cell width="4"></GridList.Cell>
                            <GridList.Cell flex="1">
                              <Text fontSize="md">Close deal with OpenAi</Text>
                              <HStack
                                fontSize="xs"
                                justifyContent="space-between"
                              >
                                <Text color="fg.muted" lineClamp={1}>
                                  Assigned by Tomasz
                                </Text>
                                <Text color="fg.muted">1d ago</Text>
                              </HStack>
                            </GridList.Cell>
                          </GridList.Item>
                        </GridList.Root>
                      </Popover.Body>
                      <Popover.Arrow />
                    </Popover.Content>
                  </Popover.Root>
                </Navbar.Item>
                <Navbar.Item>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <IconButton aria-label="Open settings" variant="ghost">
                        <LuSettings size="1.2em" />
                      </IconButton>
                    </Menu.Trigger>
                    <Menu.Content>
                      <Menu.ItemGroup title="beatriz@saas-ui.dev">
                        <Menu.Item value="profile">Profile</Menu.Item>
                        <Menu.Item value="settings">Settings</Menu.Item>
                        <Menu.Item value="help-feedback">
                          Help &amp; feedback
                        </Menu.Item>
                      </Menu.ItemGroup>
                      <Menu.Separator />
                      <Menu.Item value="log-out">Log out</Menu.Item>
                    </Menu.Content>
                  </Menu.Root>
                </Navbar.Item>
                <Navbar.Item>
                  {isMobile ? (
                    <IconButton
                      aria-label="Create"
                      variant="glass"
                      colorPalette="accent"
                    >
                      <LuPlus />
                    </IconButton>
                  ) : (
                    <Button variant="glass" size="sm" colorPalette="accent">
                      Create
                    </Button>
                  )}
                </Navbar.Item>
              </Navbar.ItemGroup>
            </Navbar.Content>
          </Navbar.Root>
        }
        sidebar={
          <Sidebar.Root>
            <Sidebar.Body flex="1" overflowY="auto" pb="8">
              <Sidebar.Group>
                <Sidebar.GroupContent>
                  <Sidebar.NavItem>
                    <Sidebar.NavButton active>
                      <LuUsers /> Overview
                    </Sidebar.NavButton>
                  </Sidebar.NavItem>
                  <Sidebar.NavItem>
                    <Sidebar.NavButton>
                      <LuListChecks /> Tasks
                    </Sidebar.NavButton>
                  </Sidebar.NavItem>
                  <Sidebar.NavItem>
                    <Sidebar.NavButton>
                      <LuLightbulb /> Insights
                    </Sidebar.NavButton>
                  </Sidebar.NavItem>
                </Sidebar.GroupContent>
              </Sidebar.Group>

              <Collapsible.Root defaultOpen asChild>
                <Sidebar.Group>
                  <Sidebar.GroupHeader>
                    <Collapsible.Trigger asChild>
                      <Sidebar.GroupTitle>Teams</Sidebar.GroupTitle>
                    </Collapsible.Trigger>
                  </Sidebar.GroupHeader>
                  <Collapsible.Content asChild>
                    <Sidebar.GroupContent>
                      <Sidebar.NavItem>
                        <Sidebar.NavButton>
                          <LuContact /> Sales
                        </Sidebar.NavButton>
                      </Sidebar.NavItem>
                      <Sidebar.NavItem>
                        <Sidebar.NavButton>
                          <LuHeartHandshake /> Support
                        </Sidebar.NavButton>
                      </Sidebar.NavItem>
                    </Sidebar.GroupContent>
                  </Collapsible.Content>
                </Sidebar.Group>
              </Collapsible.Root>

              <Collapsible.Root defaultOpen asChild>
                <Sidebar.Group>
                  <Sidebar.GroupHeader>
                    <Collapsible.Trigger asChild>
                      <Sidebar.GroupTitle>Tags</Sidebar.GroupTitle>
                    </Collapsible.Trigger>
                  </Sidebar.GroupHeader>
                  <Collapsible.Content asChild>
                    <Sidebar.GroupContent>
                      {tags.map((tag) => (
                        <Sidebar.NavItem key={tag.id}>
                          <Sidebar.NavButton>
                            <Badge
                              bg={tag.color || "gray.500"}
                              boxSize="2"
                              minH="auto"
                              minW="auto"
                              p="0"
                              borderRadius="full"
                            />
                            <Text>{tag.name}</Text>
                            <Badge
                              opacity="0.6"
                              borderRadius="full"
                              colorPalette="gray"
                              bg="none"
                              ms="auto"
                              fontWeight="medium"
                            >
                              {tag.count}
                            </Badge>
                          </Sidebar.NavButton>
                        </Sidebar.NavItem>
                      ))}
                    </Sidebar.GroupContent>
                  </Collapsible.Content>
                </Sidebar.Group>
              </Collapsible.Root>
              <IconButton
                aria-label="Help &amp; Support"
                position="absolute"
                bottom="2"
                variant="outline"
                size="xs"
                bg="bg"
                zIndex="overlay"
              >
                <span>?</span>
              </IconButton>
            </Sidebar.Body>
          </Sidebar.Root>
        }
      >
        {props.children}
      </AppShell>
    </Sidebar.Provider>
  );
};
