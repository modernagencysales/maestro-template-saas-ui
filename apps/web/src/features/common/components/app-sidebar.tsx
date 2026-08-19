'use client'

import * as React from 'react'

import { ResizeHandle, type ResizeHandler, Resizer } from '@saas-ui-pro/react'
import {
  Badge,
  Box,
  Collapsible,
  IconButton,
  Menu,
  Sidebar,
  Spacer,
  Tooltip,
  useSidebar,
} from '@saas-ui/react'
import { useHotkeysShortcut } from '@saas-ui/use-hotkeys'
import { type LinkProps, createLink, useNavigate } from '@tanstack/react-router'
import {
  LuBuilding,
  LuChartNoAxesCombined,
  LuPanelsTopLeft,
  LuPlus,
  LuSearch,
  LuSquareUser,
  LuWorkflow,
  LuZap,
} from 'react-icons/lu'

import { useModals } from '@workspace/ui/modals'

import { AppSidebarTags } from './sidebar-tags'
import { BillingStatus } from './billing-status'
import { InvitePeopleDialog } from './invite-people'
import { WorkspacesMenu } from './workspaces-menu'
import { useWorkspaceSlug } from '../hooks/use-workspace-slug'

export type AppSidebarProps = Sidebar.RootProps

export const AppSidebar: React.FC<AppSidebarProps> = (props) => {
  const modals = useModals()
  const navigate = useNavigate()
  const workspace = useWorkspaceSlug()
  const [width, setWidth] = React.useState(280)
  const { colorPalette } = props

  const onResize: ResizeHandler = ({ width }) => {
    setWidth(width)
  }

  const { mode, setMode, open, setOpen, isMobile } = useSidebar()

  return (
    <Resizer
      defaultWidth={width}
      onResize={onResize}
      enabled={!isMobile && open}
    >
      <Sidebar.Root
        {...props}
        colorPalette={colorPalette}
        borderRightWidth="1px"
      >
        <Sidebar.Trigger />

        <Sidebar.Header direction="row" alignItems="center" gap="1" py="1">
          <React.Suspense>
            <WorkspacesMenu />
          </React.Suspense>
          <Spacer />
          <IconButton
            variant="ghost"
            size="sm"
            rounded="full"
            aria-label="Search"
            onClick={() =>
              navigate({ to: '/$workspace/search', params: { workspace } })
            }
          >
            <LuSearch />
          </IconButton>
        </Sidebar.Header>

        <Sidebar.Body>
          <Sidebar.Group>
            <AppSidebarLink
              to="/$workspace/updates"
              params={{ workspace }}
              activeOptions={{ exact: false }}
              label="Updates"
              badge={2}
              icon={<LuZap />}
              hotkey="navigation.updates"
            />
            <AppSidebarLink
              to="/$workspace/contacts"
              params={{ workspace }}
              activeOptions={{ exact: false }}
              label="People"
              icon={<LuSquareUser />}
              hotkey="navigation.people"
            />
            <AppSidebarLink
              to="/$workspace/companies"
              params={{ workspace }}
              activeOptions={{ exact: false }}
              label="Companies"
              icon={<LuBuilding />}
              hotkey="navigation.companies"
            />
            <AppSidebarLink
              to="/$workspace/workflows"
              params={{ workspace }}
              activeOptions={{ exact: false }}
              label="Workflows"
              icon={<LuWorkflow />}
              hotkey="navigation.workflows"
            />
            <AppSidebarLink
              to="/$workspace/reports"
              params={{ workspace }}
              activeOptions={{ exact: true }}
              label="Reports"
              icon={<LuChartNoAxesCombined />}
              hotkey="navigation.reports"
            />
            <AppSidebarLink
              to="/ui-lab/$demo"
              params={{ demo: 'writer' }}
              activeOptions={{ exact: false }}
              label="UI Lab"
              icon={<LuPanelsTopLeft />}
              hotkey="navigation.uiLab"
            />
          </Sidebar.Group>

          <AppSidebarTags />

          <Collapsible.Root defaultOpen asChild>
            <Sidebar.Group>
              <Collapsible.Trigger asChild>
                <Sidebar.GroupHeader>
                  <Sidebar.GroupTitle>Teams</Sidebar.GroupTitle>
                </Sidebar.GroupHeader>
              </Collapsible.Trigger>

              <Collapsible.Content>
                <Sidebar.NavItem>
                  <Sidebar.NavButton
                    onClick={() => modals.open(InvitePeopleDialog)}
                    color="sidebar-muted"
                  >
                    <LuPlus /> Invite people
                  </Sidebar.NavButton>
                </Sidebar.NavItem>
              </Collapsible.Content>
            </Sidebar.Group>
          </Collapsible.Root>

          <Spacer />

          <Sidebar.Group>
            <Sidebar.NavItem>
              <Menu.Root>
                <Menu.Trigger asChild>
                  <IconButton
                    variant="outline"
                    rounded="full"
                    aria-label="Help and support"
                    size="xs"
                    bg="bg.panel"
                  >
                    ?
                  </IconButton>
                </Menu.Trigger>
                <Menu.Content minW="200px">
                  <Menu.ItemGroup title="Help">
                    <Menu.Item asChild value="docs">
                      <a href="https://saas-ui.dev/docs" target="_blank">
                        Documentation
                      </a>
                    </Menu.Item>
                    <Menu.Item asChild value="discord">
                      <a href="https://saas-ui.dev/discord" target="_blank">
                        Discord community
                      </a>
                    </Menu.Item>
                  </Menu.ItemGroup>
                </Menu.Content>
              </Menu.Root>
            </Sidebar.NavItem>
          </Sidebar.Group>
        </Sidebar.Body>

        <Sidebar.Footer>
          <BillingStatus />
        </Sidebar.Footer>

        <Sidebar.Track
          asChild
          onClick={() => {
            if (mode === 'flyout') {
              setMode('collapsible')
              setOpen(true)
            } else {
              setMode('flyout')
            }
          }}
        >
          <ResizeHandle />
        </Sidebar.Track>
      </Sidebar.Root>
    </Resizer>
  )
}

interface AppSidebarLinkProps
  extends
    Sidebar.NavItemProps,
    Pick<LinkProps, 'to' | 'params' | 'activeOptions'> {
  hotkey: string
  label: string
  icon: React.ReactNode
  badge?: React.ReactNode
}

const AppSidebarLink = (props: AppSidebarLinkProps) => {
  const { to, params, activeOptions, icon, label, hotkey, badge, ...rest } =
    props
  const navigate = useNavigate()

  const command = useHotkeysShortcut(hotkey, () => {
    navigate({ to, params })
  })

  return (
    <Tooltip
      content={
        <>
          {label} {command}
        </>
      }
      positioning={{ placement: 'right' }}
      openDelay={200}
      portalled
    >
      <Sidebar.NavItem {...rest}>
        <NavLink
          to={to}
          params={params}
          activeProps={{ 'data-active': true }}
          activeOptions={activeOptions}
        >
          {icon}

          <Box as="span" lineClamp={1}>
            {label}
          </Box>

          {typeof badge !== 'undefined' ? (
            <Badge borderRadius="sm" ms="auto" px="1.5" bg="none" size="sm">
              {badge}
            </Badge>
          ) : null}
        </NavLink>
      </Sidebar.NavItem>
    </Tooltip>
  )
}

const NavLink = createLink(Sidebar.NavButton)
