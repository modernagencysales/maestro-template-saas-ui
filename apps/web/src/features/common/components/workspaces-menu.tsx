import { Button, HStack, Spacer, Text } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import { Avatar, type AvatarProps, Menu } from '@saas-ui/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FiCheck } from 'react-icons/fi'

import { useWorkspaceSlug } from '../hooks/use-workspace-slug'
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

export const WorkspacesMenu: React.FC<WorkspacesMenuProps> = () => {
  const auth = useAuth()
  const navigate = useNavigate()
  const workspace = useWorkspaceSlug()
  const workspaces = useWorkspaces()

  const activeWorkspace = (function () {
    for (const i in workspaces) {
      if (workspaces[i]?.slug === workspace) {
        return workspaces[i]
      }
    }
    return workspaces[0]
  })()

  const setWorkspace = (nextWorkspace: string) => {
    navigate({ to: `/${nextWorkspace}` })
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
          <Link to="/getting-started">Create a workspace</Link>
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item value="settings" asChild>
          <Link to="/$workspace/settings" params={{ workspace }}>
            Settings
          </Link>
        </Menu.Item>
        <Menu.Item value="help">Help</Menu.Item>
        <Menu.Separator />
        <Menu.Item value="logout" onClick={() => auth.logOut()}>
          Log out
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  )
}
