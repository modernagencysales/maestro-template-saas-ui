import { Button, HStack, Spacer, Text } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiCheck } from 'react-icons/fi'

import * as Menu from '#ui/menu/menu'
import { Avatar, type AvatarProps } from '#ui/avatar/avatar'

import { usePath } from '../hooks/use-path'
import { useWorkspace } from '../hooks/use-workspace'
import { useWorkspaces } from '../hooks/use-workspaces'

const WorkspaceLogo: React.FC<AvatarProps> = (props) => {
  const { src, ...rest } = props
  return (
    <Avatar
      display="inline-block"
      src={src}
      size="xs"
      borderRadius="full"
      {...rest}
    />
  )
}

export interface WorkspacesMenuProps {
  compact?: boolean
}

export const WorkspacesMenu: React.FC<WorkspacesMenuProps> = (props) => {
  const auth = useAuth()
  const router = useRouter()
  const workspace = useWorkspace()
  const workspaces = useWorkspaces()

  const activeWorkspace = (function () {
    for (const i in workspaces) {
      if (workspaces[i].slug === workspace) {
        return workspaces[i]
      }
    }
    return workspaces[0]
  })()

  const setWorkspace = (workspace: string) => {
    router.push(`/${workspace}`)
  }

  const activeLogo = (
    <WorkspaceLogo name={activeWorkspace?.label} src={activeWorkspace?.logo} />
  )

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          aria-label={`Current workspace is ${activeWorkspace?.label}`}
          className="workspaces-menu"
          variant="ghost"
          ps="1"
        >
          {activeLogo}
          {activeWorkspace?.label}
        </Button>
      </Menu.Trigger>

      <Menu.Content portalled minW="200px">
        <Menu.ItemGroup title="Workspaces">
          {workspaces.map(({ slug, label, logo, ...props }) => {
            return (
              <Menu.Item
                key={slug}
                value={slug}
                onClick={() => setWorkspace(slug)}
                {...props}
              >
                <HStack>
                  <WorkspaceLogo name={label} src={logo} />
                  <Text>{label}</Text>
                  <Spacer />
                  {slug === activeWorkspace?.slug ? <FiCheck /> : null}
                </HStack>
              </Menu.Item>
            )
          })}
        </Menu.ItemGroup>
        <Menu.Item value="create" asChild>
          <Link href="/getting-started">Create a workspace</Link>
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item value="settings" asChild>
          <Link href={usePath('settings')}>Settings</Link>
        </Menu.Item>
        <Menu.Item value="Help">Help</Menu.Item>
        <Menu.Separator />
        <Menu.Item value="logout" onClick={() => auth.logOut()}>
          Log out
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  )
}
