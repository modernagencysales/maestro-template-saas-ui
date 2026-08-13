import { Has } from '@saas-ui-pro/feature-flags'
import { Avatar, type AvatarProps, Menu, Spacer, Text } from '@saas-ui/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LuCheck } from 'react-icons/lu'

import { useWorkspaceSlug } from '../hooks/use-workspace-slug'
import { useWorkspaces } from '../hooks/use-workspaces'

const WorkspaceLogo: React.FC<AvatarProps> = (props) => {
  const { src, ...rest } = props
  return (
    <Avatar
      display="inline-flex"
      src={src}
      size="xs"
      borderRadius="full"
      {...rest}
    />
  )
}

export const WorkspacesMenu: React.FC = () => {
  const navigate = useNavigate({
    from: '/$workspace/',
  })
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

  const setWorkspace = (workspace: string) => {
    navigate({
      to: `/${workspace}`,
    })
  }

  const activeLogo = (
    <WorkspaceLogo name={activeWorkspace?.label} src={activeWorkspace?.logo} />
  )

  return (
    <Menu.Root>
      <Menu.Button
        aria-label={`Current workspace is ${activeWorkspace?.label}`}
        variant="ghost"
        px="2"
        size="xs"
      >
        {activeLogo} {activeWorkspace?.label}
      </Menu.Button>

      <Menu.Content minW="200px" portalled>
        <Menu.ItemGroup title="Workspaces">
          {workspaces.map(({ slug, label, logo, ...props }) => {
            return (
              <Menu.Item
                key={slug}
                value={slug}
                onClick={() => setWorkspace(slug)}
                {...props}
              >
                <WorkspaceLogo name={label} src={logo} />

                <Text>{label}</Text>
                <Spacer />
                {slug === activeWorkspace?.slug ? <LuCheck /> : null}
              </Menu.Item>
            )
          })}
        </Menu.ItemGroup>
        <Menu.Separator />
        <Has feature="settings">
          <Menu.Item value="workspace-settings" asChild>
            <Link to="/$workspace/settings/workspace" params={{ workspace }}>
              Workspace settings
            </Link>
          </Menu.Item>
        </Has>
        <Menu.Item value="create-workspace" asChild>
          <Link to="/getting-started">Create a workspace</Link>
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  )
}
