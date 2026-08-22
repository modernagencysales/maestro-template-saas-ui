import React, { useEffect, useRef, useState } from "react";

import {
  Box,
  Breadcrumb,
  Button,
  HStack,
  SystemStyleObject,
  Tabs,
} from "@chakra-ui/react";
import { SaasUIIcon } from "@saas-ui/assets";
import { useScrollPosition } from "@saas-ui/hooks";
import { FiChevronDown } from "react-icons/fi";

import * as Menu from "@/components/ui/menu/menu";
import * as Navbar from "@/components/ui/navbar/navbar";
import * as Persona from "@/components/ui/persona/persona";
import { AppShell } from "@/components/ui/app-shell/app-shell";
import { Avatar } from "@/components/ui/avatar/avatar";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { SearchInput } from "@/components/ui/search-input/search-input";

interface SubNavProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}

const SubNav: React.FC<SubNavProps> = (props) => {
  const { scrollRef, children } = props;

  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // enable this after the first render, to make sure the scroll position is
    // correct
    setIsEnabled(true);
  }, []);

  const { y } = useScrollPosition({
    elementRef: scrollRef,
    isEnabled,
    callback({ currPos }) {
      setPosition(currPos.y);
    },
  });

  const [position, setPosition] = useState(y);
  const isScrolling = scrollRef.current && position > 40;

  const offset = 2;

  return (
    <HStack
      position="sticky"
      top={offset}
      zIndex="sticky"
      borderBottomWidth="1px"
      gap="0"
      css={{
        "--logo-position": isScrolling ? "0" : "-52px",
        "--logo-opacity": isScrolling ? "1" : "0",
        "--menu-gap": isScrolling ? "0" : "-36px",
      }}
    >
      <HStack mt={-offset} gap="0" px="6" flex="1" bg="bg">
        <Box
          opacity="var(--logo-opacity)"
          transform="translate3d(0, var(--logo-position), 0)"
          transition="transform 0.2s ease-out, opacity 0.2s"
        >
          <SaasUIIcon height="24px" />
        </Box>
        <Tabs.Root
          defaultValue="overview"
          size="md"
          transform="translate3d(var(--menu-gap), 0, 0)"
          transition="transform 0.2s ease-out"
        >
          <Tabs.List pt="2" px="1" borderBottom="0">
            {children}
          </Tabs.List>
        </Tabs.Root>
      </HStack>
    </HStack>
  );
};

const tabStyles: SystemStyleObject = {
  position: "relative",
  height: 10,
  pb: "2",
  px: "3",
  color: "muted",
  _hover: {
    color: "currentColor",
    _before: {
      content: '""',
      position: "absolute",
      inset: 0,
      mb: "1.5",
      rounded: "md",
      bgColor: "blackAlpha.100",
      transitionProperty: "background-color",
      transitionDuration: "normal",
    },
    _dark: {
      _before: {
        bgColor: "whiteAlpha.200",
      },
    },
  },
  _active: {
    bg: "none",
  },
  _selected: {
    color: "currentColor",
    _after: {
      content: '""',
      position: "absolute",
      bottom: 0,
      rounded: "md",
      bgColor: "currentColor",
      width: "70%",
      height: "2px",
    },
  },
};

const SubNavItem: React.FC<Tabs.TriggerProps> = (props) => {
  return (
    <Tabs.Trigger
      {...props}
      css={{
        ...tabStyles,
        ...props.css,
      }}
    >
      {props.children}
    </Tabs.Trigger>
  );
};

export const NavbarTabs: React.FC<React.PropsWithChildren> = (props) => {
  const scrollRef = useRef<HTMLDivElement>(null!);

  return (
    <AppShell
      ref={scrollRef}
      overflowY="auto"
      height="480px"
      bg="bg"
      header={
        <>
          <Navbar.Root>
            <Navbar.Content>
              <Breadcrumb.Root>
                <Breadcrumb.List>
                  <Breadcrumb.Item>
                    <Breadcrumb.Link href="#">
                      <Navbar.Brand>
                        <SaasUIIcon height="24px" />
                      </Navbar.Brand>
                    </Breadcrumb.Link>
                  </Breadcrumb.Item>
                  <Breadcrumb.Separator>
                    <Box as="span" opacity="0.4" mx="1">
                      /
                    </Box>
                  </Breadcrumb.Separator>
                  <Breadcrumb.Item>
                    <Menu.Root>
                      <Menu.Trigger asChild>
                        <Button variant="ghost" px="1.5">
                          <Avatar
                            size="xs"
                            icon={<></>}
                            bgGradient="to-r"
                            gradientFrom="yellow.200"
                            gradientTo="pink.500"
                          />{" "}
                          Acme <FiChevronDown />
                        </Button>
                      </Menu.Trigger>
                      <Menu.Content>
                        <Menu.ItemGroup title="Workspaces">
                          <Menu.Item value="acme">Acme</Menu.Item>
                        </Menu.ItemGroup>
                        <Menu.Separator />
                        <Menu.Item value="create-workspace">
                          Create workspace
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Root>
                  </Breadcrumb.Item>
                </Breadcrumb.List>
              </Breadcrumb.Root>
            </Navbar.Content>
            <Navbar.Content justifyContent="end" gap="4">
              <Box width="180px">
                <SearchInput size="sm" />
              </Box>
              <Menu.Root>
                <Menu.Trigger asChild>
                  <IconButton
                    aria-label="Open user menu"
                    variant="ghost"
                    rounded="full"
                    size="xs"
                  >
                    <Persona.Root size="xs" presence="online">
                      <Persona.Avatar src="/showcase-avatar.jpg" name="Beatriz">
                        <Persona.PresenceBadge />
                      </Persona.Avatar>
                    </Persona.Root>
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
            </Navbar.Content>
          </Navbar.Root>
          <SubNav scrollRef={scrollRef}>
            <SubNavItem value="overview">Overview</SubNavItem>
            <SubNavItem value="activity">Activity</SubNavItem>
            <SubNavItem value="integrations">Integrations</SubNavItem>
            <SubNavItem value="usage">Usage</SubNavItem>
            <SubNavItem value="settings">Settings</SubNavItem>
          </SubNav>
        </>
      }
    >
      {props.children}
    </AppShell>
  );
};
