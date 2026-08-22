import * as React from 'react'

import { Heading, useBreakpointValue } from '@chakra-ui/react'
import { useLocalStorageValue } from '@react-hookz/web'
import { Has } from '@saas-ui-pro/feature-flags'
import { ResizeHandle, ResizeHandler, Resizer } from '@saas-ui-pro/react'
import Link from 'next/link'
import { FiFolder, FiUser } from 'react-icons/fi'

import * as Sidebar from '#ui/sidebar/sidebar'
import { useHelpCenter } from '#components/help-center'
import { useActivePath } from '#features/common/hooks/use-active-path'
import { usePath } from '#features/common/hooks/use-path'
import { useHotkeysShortcut } from '#features/common/lib/hotkeys'
import { BackButton } from '#ui/back-button/back-button'

const SettingsLink = (props: Sidebar.NavItemProps & { path: string }) => {
  const { path, children, ...rest } = props
  const href = usePath(`/settings${path}`)
  return (
    <Sidebar.NavItem ps="5" {...rest}>
      <Sidebar.NavButton active={useActivePath(href)} asChild>
        <Link href={href} prefetch={false}>
          {children}
        </Link>
      </Sidebar.NavButton>
    </Sidebar.NavItem>
  )
}

export const SettingsSidebar = () => {
  const backRef = React.useRef<HTMLButtonElement>(null)

  const help = useHelpCenter()

  useHotkeysShortcut('settings.close', () => {
    // Simply triggering a click here, so we don't need to reference the router.
    backRef.current?.click()
  })

  const sidebarWidth = useLocalStorageValue('app.sidebar.width', {
    defaultValue: 280,
  })

  const onResize: ResizeHandler = ({ width }) => {
    sidebarWidth.set(width)
  }

  return (
    <Resizer
      defaultWidth={sidebarWidth.value}
      onResize={onResize}
      enabled={useBreakpointValue(
        { base: false, lg: true },
        { fallback: 'lg' },
      )}
    >
      <Sidebar.Root>
        {/* <Sidebar.ToggleButton /> */}

        <Sidebar.Header direction="row" alignItems="center">
          <BackButton href={usePath()} ref={backRef} />
          <Heading as="h1" textStyle="lg">
            Settings
          </Heading>
        </Sidebar.Header>
        <Sidebar.Body flex="1" overflowY="auto">
          <Has feature="settings">
            <Sidebar.Group>
              <Sidebar.GroupHeader>
                <Sidebar.GroupTitle gap="2">
                  <FiFolder /> Organization
                </Sidebar.GroupTitle>
              </Sidebar.GroupHeader>
              <Sidebar.GroupContent>
                <SettingsLink path="/">Overview</SettingsLink>
                <SettingsLink path="/organization">Organization</SettingsLink>
                <SettingsLink path="/members">Members</SettingsLink>
                <SettingsLink path="/plans">Plans</SettingsLink>
                <SettingsLink path="/billing">Billing</SettingsLink>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Has>

          <Sidebar.Group>
            <Sidebar.GroupHeader>
              <Sidebar.GroupTitle gap="2">
                <FiUser /> Account
              </Sidebar.GroupTitle>
            </Sidebar.GroupHeader>
            <Sidebar.GroupContent>
              <SettingsLink path="/account">Profile</SettingsLink>
              <SettingsLink path="/account/security">Security</SettingsLink>
              <SettingsLink path="/account/notifications">
                Notifications
              </SettingsLink>
              <SettingsLink path="/account/api">API access</SettingsLink>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        </Sidebar.Body>

        <ResizeHandle />
      </Sidebar.Root>
    </Resizer>
  )
}
