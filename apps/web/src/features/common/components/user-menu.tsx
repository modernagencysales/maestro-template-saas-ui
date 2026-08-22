'use client'

import { IconButton } from '@chakra-ui/react'
import { Has } from '@saas-ui-pro/feature-flags'
import { useAuth } from '@saas-ui/auth-provider'
import { Menu } from '@saas-ui/react'
import { useHotkeysShortcut } from '@saas-ui/use-hotkeys'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'

import { useColorMode } from '#components/color-mode.tsx'
import { UserAvatar } from '#components/user-avatar'

import { useCurrentUser } from '../hooks/use-current-user'
import { useWorkspaceSlug } from '../hooks/use-workspace-slug'

export const UserMenu = () => {
  const workspace = useWorkspaceSlug()
  const navigate = useNavigate({
    from: '/$workspace/',
  })
  const { logOut } = useAuth()

  const [currentUser] = useCurrentUser()

  const queryClient = useQueryClient()

  const logOutAndClearCache = () => {
    logOut().then(() => {
      queryClient.clear()
      navigate({
        to: '/login',
      })
    })
  }

  const { toggleColorMode, colorMode } = useColorMode()

  const logoutCommand = useHotkeysShortcut('general.logout', () => {
    logOutAndClearCache()
  })

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          variant="ghost"
          aria-label="User menu"
          rounded="full"
          size="xs"
        >
          <UserAvatar size="xs" user={currentUser} presence="online" />
        </IconButton>
      </Menu.Trigger>

      <Menu.Content minW="200px" portalled>
        <Menu.ItemGroup title={currentUser?.name || ''}>
          <Menu.Item value="profile" asChild>
            <Link
              to="/$workspace/settings/account"
              params={{
                workspace,
              }}
            >
              Profile
            </Link>
          </Menu.Item>
          <Has feature="settings">
            <Menu.Item value="settings" asChild>
              <Link
                to="/$workspace/settings/workspace"
                params={{
                  workspace,
                }}
              >
                Settings
              </Link>
            </Menu.Item>
          </Has>
        </Menu.ItemGroup>
        <Menu.Separator />
        <Menu.Item
          value="toggle-color-mode"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault()
            toggleColorMode()
          }}
        >
          {colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item value="logout" onClick={() => logOutAndClearCache()}>
          Log out
          <Menu.ItemCommand>{logoutCommand}</Menu.ItemCommand>
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  )
}
