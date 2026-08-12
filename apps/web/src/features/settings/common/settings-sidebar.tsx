import * as React from "react";
import * as Sui from "@saas-ui/react";

import { Icon, useBreakpointValue } from "@chakra-ui/react";
import { Has } from "@saas-ui-pro/feature-flags";
import { ResizeHandle, ResizeHandler } from "@saas-ui-pro/react";
import { useHotkeysShortcut } from "@saas-ui/use-hotkeys";
import { createLink, linkOptions, useNavigate } from "@tanstack/react-router";
import {
  LuArrowLeft,
  LuBuilding,
  LuColumns3,
  LuCreditCard,
  LuShieldCheck,
  LuTags,
  LuUser,
  LuUsersRound,
} from "react-icons/lu";

import { useHelpCenter } from "@workspace/ui/help-center";

import { LinkButton } from "#components/link-button";
import { useUserSettings } from "#lib/user-settings/use-user-settings";

import { ClientResizer } from "../../common/components/client-resizer";

const SettingsLinkBase = React.forwardRef<
  HTMLButtonElement,
  Sui.Sidebar.NavButtonProps
>(function SettingsLinkBase(props, ref) {
  return (
    <Sui.Sidebar.NavItem>
      <Sui.Sidebar.NavButton as="a" ref={ref} {...props} />
    </Sui.Sidebar.NavItem>
  );
});

const SettingsLink = createLink(SettingsLinkBase);

export const SettingsSidebar = () => {
  const navigate = useNavigate();

  const help = useHelpCenter();

  useHotkeysShortcut("general.help", () => {
    help.open();
  });

  useHotkeysShortcut("settings.close", () => {
    navigate({
      to: "/",
      params: {},
    });
  });

  const [{ sidebarWidth }, setUserSettings] = useUserSettings();

  const onResize: ResizeHandler = ({ width }) => {
    setUserSettings("sidebarWidth", width);
  };

  const getLinkOptions = (to: string) => {
    return linkOptions({
      from: "/settings",
      to: `./${to}`,
      activeOptions: { exact: true },
      activeProps: {
        "data-active": true,
      },
    });
  };

  return (
    <ClientResizer
      defaultWidth={sidebarWidth}
      onResize={onResize}
      enabled={useBreakpointValue(
        { base: false, lg: true },
        { fallback: "lg" },
      )}
    >
      <Sui.Sidebar.Root borderRightWidth="1px">
        <Sui.Sidebar.Header>
          <LinkButton
            to="/"
            variant="ghost"
            size="sm"
            _hover={{
              bg: "sidebar.accent.bg",
            }}
          >
            <Icon
              as={LuArrowLeft}
              transitionProperty="transform"
              transitionDuration="moderate"
              css={{
                "a:hover &": {
                  transform: "translateX(-3px)",
                },
              }}
            />
            Back to app
          </LinkButton>
        </Sui.Sidebar.Header>
        <Sui.Sidebar.Body>
          <Sui.Sidebar.Group>
            <Sui.Sidebar.GroupHeader>
              <Sui.Sidebar.GroupTitle gap="2">Account</Sui.Sidebar.GroupTitle>
            </Sui.Sidebar.GroupHeader>
            <Sui.Sidebar.GroupContent>
              <SettingsLink {...getLinkOptions("/account/profile")}>
                <LuUser /> Profile
              </SettingsLink>
              <SettingsLink {...getLinkOptions("/account/security")}>
                <LuShieldCheck />
                Security
              </SettingsLink>
            </Sui.Sidebar.GroupContent>
          </Sui.Sidebar.Group>

          <Has feature="settings">
            <Sui.Sidebar.Group>
              <Sui.Sidebar.GroupHeader>
                <Sui.Sidebar.GroupTitle gap="2">
                  Workspace
                </Sui.Sidebar.GroupTitle>
              </Sui.Sidebar.GroupHeader>
              <Sui.Sidebar.GroupContent>
                <SettingsLink {...getLinkOptions("/workspace")}>
                  <LuBuilding /> Workspace
                </SettingsLink>
                <SettingsLink {...getLinkOptions("/members")}>
                  <LuUsersRound /> Members
                </SettingsLink>
                <SettingsLink {...getLinkOptions("/tags")}>
                  <LuTags /> Tags
                </SettingsLink>
                <SettingsLink {...getLinkOptions("/plans")}>
                  <LuColumns3 /> Plans
                </SettingsLink>
                <SettingsLink {...getLinkOptions("/billing")}>
                  <LuCreditCard />
                  Billing
                </SettingsLink>
              </Sui.Sidebar.GroupContent>
            </Sui.Sidebar.Group>
          </Has>
        </Sui.Sidebar.Body>
        <Sui.Sidebar.Footer>
          <ResizeHandle />
        </Sui.Sidebar.Footer>
      </Sui.Sidebar.Root>
    </ClientResizer>
  );
};
