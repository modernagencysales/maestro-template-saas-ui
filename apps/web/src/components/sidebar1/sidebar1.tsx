import * as React from "react";

import {
  Avatar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Collapsible,
  Tabs,
  Text,
} from "@chakra-ui/react";
import {
  LuBuilding,
  LuChevronsUpDown,
  LuLightbulb,
  LuListChecks,
  LuPanelLeftClose,
  LuPlus,
  LuUsers,
} from "react-icons/lu";

import * as Menu from "@/components/ui/menu/menu";
import * as Page from "@/components/ui/page/page";
import * as Sidebar from "@/components/ui/sidebar/sidebar";
import { AppShell } from "@/components/ui/app-shell/app-shell";
import { IconButton } from "@/components/ui/icon-button/icon-button";

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

export const Sidebar1 = () => {
  return (
    <Sidebar.Provider variant="inset">
      <AppShell
        height="600px"
        bg="sidebar.bg"
        sidebar={
          <Sidebar.Root>
            <Sidebar.Header>
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button
                    variant="ghost"
                    justifyContent="flex-start"
                    w="full"
                    h="10"
                    px="2"
                  >
                    <Avatar.Root bg="neutral" color="fg.neutral" size="xs">
                      <Avatar.Fallback />
                    </Avatar.Root>
                    Acme Corp
                    <LuChevronsUpDown size="1em" />
                  </Button>
                </Menu.Trigger>
                <Menu.Content>
                  <Menu.Item value="Acme Corp">Acme Corp</Menu.Item>
                  <Menu.Separator />
                  <Menu.Item value="Create workspace">
                    Create workspace
                  </Menu.Item>
                </Menu.Content>
              </Menu.Root>
            </Sidebar.Header>
            <Sidebar.Body py="1">
              <Sidebar.Group>
                <Sidebar.GroupContent>
                  <NavItem active>
                    <LuUsers /> People
                  </NavItem>
                  <NavItem>
                    <LuBuilding /> Companies
                  </NavItem>
                  <NavItem>
                    <LuListChecks />
                    Tasks
                  </NavItem>
                  <NavItem>
                    <LuLightbulb />
                    Insights
                  </NavItem>
                </Sidebar.GroupContent>
              </Sidebar.Group>

              <Collapsible.Root defaultOpen>
                <Sidebar.Group>
                  <Collapsible.Trigger asChild>
                    <Sidebar.GroupHeader>
                      <Sidebar.GroupTitle>Tags</Sidebar.GroupTitle>
                    </Sidebar.GroupHeader>
                  </Collapsible.Trigger>
                  <Collapsible.Content asChild>
                    <Sidebar.GroupContent>
                      {tags.map((tag) => (
                        <Sidebar.NavItem key={tag.id} my="0">
                          <Sidebar.NavButton>
                            <Box
                              bg={tag.color || "gray.500"}
                              boxSize="2"
                              borderRadius="full"
                            />
                            <Text as="span" textStyle="sm">
                              {tag.name}
                            </Text>
                            <Badge
                              colorPalette="gray"
                              color="fg.subtle"
                              borderRadius="full"
                              bg="none"
                              ms="auto"
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
                rounded="full"
                position="absolute"
                bottom="2"
                variant="outline"
                size="xs"
                bg="bg.panel"
                zIndex="overlay"
              >
                <span>?</span>
              </IconButton>
            </Sidebar.Body>
          </Sidebar.Root>
        }
      >
        <Sidebar.Inset>
          <Page.Root>
            <Page.Header
              title={<Page.Title textStyle="lg">People</Page.Title>}
              border="0"
              nav={
                <Box display={{ base: "block", lg: "none" }}>
                  <Sidebar.Trigger asChild>
                    <IconButton
                      variant="ghost"
                      aria-label="Toggle sidebar"
                      size="xs"
                    >
                      <LuPanelLeftClose size="1em" />
                    </IconButton>
                  </Sidebar.Trigger>
                </Box>
              }
              actions={
                <ButtonGroup justifyContent="flex-end">
                  <Button variant="ghost" size="xs">
                    <LuPlus size="1em" /> Add person
                  </Button>
                </ButtonGroup>
              }
            ></Page.Header>
            <Tabs.Root defaultValue="all" colorPalette="primary">
              <Tabs.List px="4" borderBottomWidth="1px">
                <Tabs.Trigger value="all">All</Tabs.Trigger>
                <Tabs.Trigger value="leads">Leads</Tabs.Trigger>
                <Tabs.Trigger value="customers">Customers</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
            <Page.Body></Page.Body>
          </Page.Root>
        </Sidebar.Inset>
      </AppShell>
    </Sidebar.Provider>
  );
};

function NavItem(props: Sidebar.NavButtonProps) {
  return (
    <Sidebar.NavItem
      position="relative"
      css={{
        "&:has([data-active]):before": {
          content: '""',
          display: "block",
          position: "absolute",
          left: "-12px",
          top: "50%",
          transform: "translateY(-50%)",
          borderRightRadius: "3px",
          bg: "accent.solid",
          width: "3px",
          height: "24px",
        },
      }}
    >
      <Sidebar.NavButton {...props}>{props.children}</Sidebar.NavButton>
    </Sidebar.NavItem>
  );
}
