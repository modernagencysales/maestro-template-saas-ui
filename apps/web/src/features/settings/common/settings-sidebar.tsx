import * as React from 'react'

import { Heading, useBreakpointValue } from '@chakra-ui/react'
import { Has } from '@saas-ui-pro/feature-flags'
import { ResizeHandle, ResizeHandler, Resizer } from '@saas-ui-pro/react'
// eslint-disable-next-line template/saas-ui-shell-authority -- the settings layout is the pinned Pro shell projected through TanStack links.
import { Sidebar } from '@saas-ui/react'
import { useHotkeysShortcut } from '@saas-ui/use-hotkeys'
import { createLink, linkOptions, useNavigate } from '@tanstack/react-router'
import {
  LuBell,
  LuBuilding,
  LuColumns3,
  LuCreditCard,
  LuKeyRound,
  LuShieldCheck,
  LuTags,
  LuUser,
  LuUsersRound,
} from 'react-icons/lu'

import { useHelpCenter } from '@workspace/ui/help-center'

import { BackButton } from '#components/back-button'
import { useWorkspaceSlug } from '#features/common/hooks/use-workspace-slug'
import { useUserSettings } from '#lib/user-settings/use-user-settings'

const SettingsLinkBase = React.forwardRef<
  HTMLButtonElement,
  Sidebar.NavButtonProps
>(function SettingsLinkBase(props, ref) {
  return (
    <Sidebar.NavItem>
      <Sidebar.NavButton as="a" ref={ref} {...props} />
    </Sidebar.NavItem>
  )
})

const SettingsLink = createLink(SettingsLinkBase)

export const SettingsSidebar = () => {
  const workspace = useWorkspaceSlug()

  const navigate = useNavigate()

  const help = useHelpCenter()

  useHotkeysShortcut('general.help', () => {
    help.open()
  })

  useHotkeysShortcut('settings.close', () => {
    navigate({
      to: '/$workspace',
      params: {
        workspace,
      },
    })
  })

  const [{ sidebarWidth }, setUserSettings] = useUserSettings()

  const onResize: ResizeHandler = ({ width }) => {
    setUserSettings('sidebarWidth', width)
  }

  const getLinkOptions = (to: string) => {
    return linkOptions({
      from: '/$workspace/settings',
      to: `./${to}`,
      params: { workspace },
      activeOptions: { exact: true },
      activeProps: {
        'data-active': true,
      },
    })
  }

  return (
    <Resizer
      defaultWidth={sidebarWidth}
      onResize={onResize}
      enabled={useBreakpointValue(
        { base: false, lg: true },
        { fallback: 'lg' },
      )}
    >
      <Sidebar.Root>
        <Sidebar.Header direction="row" alignItems="center">
          <BackButton
            to="/$workspace"
            params={{ workspace }}
            aria-label="Back to app"
          />
          <Heading as="h1" textStyle="lg">
            Settings
          </Heading>
        </Sidebar.Header>
        <Sidebar.Body>
          <Sidebar.Group>
            <Sidebar.GroupHeader>
              <Sidebar.GroupTitle gap="2">Account</Sidebar.GroupTitle>
            </Sidebar.GroupHeader>
            <Sidebar.GroupContent>
              <SettingsLink {...getLinkOptions('/account/profile')}>
                <LuUser /> Profile
              </SettingsLink>
              <SettingsLink {...getLinkOptions('/account/security')}>
                <LuShieldCheck />
                Security
              </SettingsLink>
              <SettingsLink {...getLinkOptions('/account/notifications')}>
                <LuBell /> Notifications
              </SettingsLink>
              <SettingsLink {...getLinkOptions('/account/api')}>
                <LuKeyRound /> API access
              </SettingsLink>
            </Sidebar.GroupContent>
          </Sidebar.Group>

          <Has feature="settings">
            <Sidebar.Group>
              <Sidebar.GroupHeader>
                <Sidebar.GroupTitle gap="2">Workspace</Sidebar.GroupTitle>
              </Sidebar.GroupHeader>
              <Sidebar.GroupContent>
                <SettingsLink {...getLinkOptions('')}>Overview</SettingsLink>
                <SettingsLink {...getLinkOptions('/workspace')}>
                  <LuBuilding /> Workspace
                </SettingsLink>
                <SettingsLink {...getLinkOptions('/members')}>
                  <LuUsersRound /> Members
                </SettingsLink>
                <SettingsLink {...getLinkOptions('/tags')}>
                  <LuTags /> Tags
                </SettingsLink>
                <SettingsLink {...getLinkOptions('/plans')}>
                  <LuColumns3 /> Plans
                </SettingsLink>
                <SettingsLink {...getLinkOptions('/billing')}>
                  <LuCreditCard />
                  Billing
                </SettingsLink>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Has>
        </Sidebar.Body>
        <ResizeHandle />
      </Sidebar.Root>
    </Resizer>
  )
}
