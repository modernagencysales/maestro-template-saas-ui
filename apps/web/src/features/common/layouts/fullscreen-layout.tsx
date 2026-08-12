"use client";

import { HStack, Text } from "@chakra-ui/react";
import { useAuth } from "@saas-ui/auth-provider";
import { AppShell, Menu } from "@saas-ui/react";

import { BackButton } from "../../../components/back-button";

import { AppLayout, AppLayoutProps } from "./app-layout";

/**
 * Fullscreen layout, for functionality that requires extra focus, like onboarding/checkout/etc.
 */
export const FullscreenLayout: React.FC<
  AppLayoutProps & { hideBackButton?: boolean }
> = ({ children, hideBackButton, ...rest }) => {
  const { user, logOut } = useAuth();

  let menu;
  if (user) {
    menu = (
      <Menu.Root>
        <Menu.Button
          variant="ghost"
          textAlign="left"
          py="2"
          height="auto"
          lineHeight="1.6"
        >
          <Text textStyle="xs" color="fg.muted" fontWeight="normal">
            Logged in as
          </Text>
          <Text fontWeight="medium">{user?.email}</Text>
        </Menu.Button>
        <Menu.Content>
          <Menu.Item value="logout" onClick={() => logOut()}>
            Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>
    );
  }

  return (
    <AppShell {...rest}>
      <HStack
        position="fixed"
        zIndex="overlay"
        top="0"
        px="4"
        py="2"
        width="full"
      >
        {!hideBackButton && <BackButton to="/" />}
        {menu}
      </HStack>
      {children}
    </AppShell>
  );
};
