import * as React from "react";

import { Avatar, Badge, Collapsible, Icon, Text } from "@chakra-ui/react";
import { SaasUIIcon } from "@saas-ui/assets";
import {
  RiCodeBoxFill,
  RiExpandUpDownLine,
  RiFeedbackFill,
  RiFolder4Fill,
  RiFolderWarningFill,
  RiInbox2Fill,
  RiLightbulbFill,
  RiMarkupFill,
  RiStarFill,
  RiTaskFill,
} from "react-icons/ri";

import * as Menu from "@/components/ui/menu/menu";
import * as Sidebar from "@/components/ui/sidebar/sidebar";
import { AppShell } from "@/components/ui/app-shell/app-shell";
import { IconButton } from "@/components/ui/icon-button/icon-button";

import { SidebarDarkMode } from "./sidebar2-color-mode";

const favourites = [
  {
    id: "design",
    name: "Design",
    count: 83,
    color: "purple.400",
    icon: <Icon as={RiMarkupFill} fill="purple.400" boxSize="1.2em" />,
  },
  {
    id: "code",
    name: "Code",
    count: 210,
    icon: <Icon as={RiCodeBoxFill} boxSize="1.2em" />,
  },
  {
    id: "important",
    name: "Important",
    count: 12,
    color: "red.400",
    icon: <Icon as={RiFolderWarningFill} fill="red.400" boxSize="1.2em" />,
  },
  {
    id: "feedback",
    name: "Feedback",
    count: 10,
    color: "yellow.400",
    icon: <Icon as={RiFeedbackFill} fill="yellow.400" boxSize="1.2em" />,
  },
];

export const Sidebar2 = (props: React.PropsWithChildren) => {
  return (
    <Sidebar.Provider variant="inset">
      <AppShell
        height="600px"
        bg="black"
        _dark={{ bg: "black" }}
        sidebar={
          <SidebarDarkMode>
            <Sidebar.Root
              bg="black"
              _dark={{ bg: "black" }}
              borderRightWidth="0"
              data-theme="dark"
            >
              <Sidebar.Header pt="3">
                <Menu.Root>
                  <Menu.Button
                    variant="ghost"
                    textAlign="left"
                    w="full"
                    h="10"
                    px="2"
                  >
                    <Avatar.Root bg="primary.500" size="sm">
                      <Avatar.Fallback>
                        <SaasUIIcon width="14px" color="white" />
                      </Avatar.Fallback>
                    </Avatar.Root>{" "}
                    Acme Corp{" "}
                    <Icon as={RiExpandUpDownLine} ms="auto" color="muted" />
                  </Menu.Button>
                  <Menu.Content>
                    <Menu.Item value="Acme Corp">Acme Corp</Menu.Item>
                    <Menu.Separator />
                    <Menu.Item value="Create workspace">
                      Create workspace
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Root>
              </Sidebar.Header>
              <Sidebar.Body pb="8">
                <Sidebar.Group>
                  <Sidebar.GroupContent>
                    <Sidebar.NavItem>
                      <Sidebar.NavButton asChild>
                        <a href="#">
                          <Icon as={RiInbox2Fill} boxSize="1.2em" />
                          Inbox
                        </a>
                      </Sidebar.NavButton>
                    </Sidebar.NavItem>
                    <Sidebar.NavItem>
                      <Sidebar.NavButton asChild>
                        <a href="#">
                          <Icon as={RiTaskFill} boxSize="1.2em" />
                          My tasks
                        </a>
                      </Sidebar.NavButton>
                    </Sidebar.NavItem>
                    <Sidebar.NavItem>
                      <Sidebar.NavButton asChild>
                        <a href="#">
                          <Icon as={RiFolder4Fill} boxSize="1.2em" />
                          Views
                        </a>
                      </Sidebar.NavButton>
                    </Sidebar.NavItem>
                    <Sidebar.NavItem>
                      <Sidebar.NavButton asChild>
                        <a href="#">
                          <Icon as={RiLightbulbFill} boxSize="1.2em" />
                          Insights
                        </a>
                      </Sidebar.NavButton>
                    </Sidebar.NavItem>
                  </Sidebar.GroupContent>
                </Sidebar.Group>

                <Collapsible.Root asChild>
                  <Sidebar.Group title="Favourites">
                    <Sidebar.GroupHeader>
                      <Collapsible.Trigger asChild>
                        <Sidebar.GroupTitle>
                          <Icon as={RiStarFill} boxSize="1.2em" />
                          Favourites
                        </Sidebar.GroupTitle>
                      </Collapsible.Trigger>
                    </Sidebar.GroupHeader>
                    <Collapsible.Content asChild>
                      <Sidebar.GroupContent>
                        {favourites.map((item) => (
                          <Sidebar.NavItem key={item.id}>
                            <Sidebar.NavButton asChild>
                              <a href="#">
                                {item.icon}
                                <Text>{item.name}</Text>
                                <Badge
                                  opacity="0.6"
                                  borderRadius="full"
                                  bg="none"
                                  ms="auto"
                                  fontWeight="medium"
                                >
                                  {item.count}
                                </Badge>
                              </a>
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
                  bg="app-background"
                  zIndex="overlay"
                >
                  <span>?</span>
                </IconButton>
              </Sidebar.Body>
            </Sidebar.Root>
          </SidebarDarkMode>
        }
      >
        <Sidebar.Inset>{props.children}</Sidebar.Inset>
      </AppShell>
    </Sidebar.Provider>
  );
};
