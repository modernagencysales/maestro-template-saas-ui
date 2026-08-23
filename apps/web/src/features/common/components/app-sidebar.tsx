'use client'

import * as React from 'react'

import { ResizeHandle, ResizeHandler, Resizer } from '@saas-ui-pro/react'
import {
  Badge,
  Box,
  Command,
  HStack,
  IconButton,
  Menu,
  Spacer,
  Tooltip,
} from '@saas-ui/react'
import { useHotkeysShortcut } from '@saas-ui/use-hotkeys'
import {
  Link,
  type LinkProps,
  createLink,
  useNavigate,
} from '@tanstack/react-router'
import {
  LuHouse,
  LuInbox,
  LuLayoutDashboard,
  LuPlus,
  LuSearch,
  LuSquareUser,
  LuSparkles,
} from 'react-icons/lu'

import { useModals } from '@workspace/ui/modals'

import { useUserSettings } from '#lib/user-settings/use-user-settings'
import { productShell } from '#config/product-shell'
import { Sidebar, useSidebar } from '#components/ui/sidebar'

import { useWorkspaceSlug } from '../hooks/use-workspace-slug'
import { BillingStatus } from './billing-status'
import { InvitePeopleDialog } from './invite-people'
import { AppSidebarTags } from './sidebar-tags'
import { UserMenu } from './user-menu'
import { WorkspacesMenu } from './workspaces-menu'

export type AppSidebarProps = Sidebar.RootProps;

export const AppSidebar: React.FC<AppSidebarProps> = (props) => {
  const modals = useModals()

  const workspace = useWorkspaceSlug()

  const [{ sidebarWidth }, setUserSettings] = useUserSettings()

  const onResize: ResizeHandler = ({ width }) => {
    setUserSettings('sidebarWidth', width)
  }

  const { mode, setMode, open, setOpen, isMobile } = useSidebar()

  return (
    <Resizer
      defaultWidth={sidebarWidth}
      onResize={onResize}
      enabled={!isMobile && open}
    >
      <Sidebar.Root {...props}>
        <Sidebar.Header alignItems="center" gap="1">
          <React.Suspense>
            <WorkspacesMenu />
          </React.Suspense>

          <Spacer />
          <IconButton
            variant="ghost"
            size="xs"
            rounded="full"
            aria-label="Search"
            asChild
          >
            <Link to="/$workspace/search" params={{ workspace }}>
              <LuSearch size="1.1em" />
            </Link>
          </IconButton>
          <React.Suspense>
            <UserMenu />
          </React.Suspense>
        </Sidebar.Header>

        <Sidebar.Body>
          <Sidebar.Group>
            <AppSidebarLink
              to={productShell.navigation.dashboard.to}
              params={{
                workspace,
              }}
              activeOptions={{
                exact: true,
              }}
              label={productShell.navigation.dashboard.label}
              icon={<LuHouse />}
              hotkey="navigation.dashboard"
            />
            <AppSidebarLink
              to={productShell.navigation.inbox.to}
              params={{
                workspace,
              }}
              activeOptions={{
                exact: false,
              }}
              label={productShell.navigation.inbox.label}
              badge={2}
              icon={<LuInbox />}
              hotkey="navigation.inbox"
            />
            <AppSidebarLink
              to={productShell.navigation.contacts.to}
              params={{
                workspace,
              }}
              activeOptions={{
                exact: false,
              }}
              label={productShell.navigation.contacts.label}
              icon={<LuSquareUser />}
              hotkey="navigation.contacts"
            />
            <AppSidebarLink
              to={productShell.navigation.kanban.to}
              params={{ workspace }}
              activeOptions={{ exact: true }}
              label={productShell.navigation.kanban.label}
              icon={<LuLayoutDashboard />}
              hotkey="navigation.kanban"
            />
            <AppSidebarLink
              to={productShell.navigation.showcase.to}
              params={{ workspace }}
              activeOptions={{ exact: true }}
              label={productShell.navigation.showcase.label}
              icon={<LuSparkles />}
              hotkey="navigation.showcase"
            />
          </Sidebar.Group>

          <AppSidebarTags />

          <Sidebar.Group>
            <Sidebar.GroupHeader>
              <Sidebar.GroupTitle>Teams</Sidebar.GroupTitle>
            </Sidebar.GroupHeader>
            <Sidebar.NavItem onClick={() => modals.open(InvitePeopleDialog)}>
              <Sidebar.NavButton>
                <LuPlus />
                Invite people
              </Sidebar.NavButton>
            </Sidebar.NavItem>
          </Sidebar.Group>
        </Sidebar.Body>

        <Sidebar.Footer>
          <BillingStatus />

          <HStack>
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  variant="surface"
                  size="xs"
                  rounded="full"
                  aria-label="Search"
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
          </HStack>
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

interface AppSidebarlink
  extends
    Sidebar.NavItemProps,
    Pick<LinkProps, 'to' | 'params' | 'activeOptions'> {
  hotkey: string
  label: string
  icon: React.ReactNode
  badge?: React.ReactNode
}

const AppSidebarLink = (props: AppSidebarlink) => {
  const { to, params, activeOptions, icon, label, hotkey, badge, ...rest } =
    props

  const navigate = useNavigate({
    from: '/$workspace/',
  })

  const command = useHotkeysShortcut(hotkey, () => {
    navigate({
      to,
      params,
    })
  }, [to])

  return (
    <Tooltip
      content={
        <>
          {label} <Command size="sm">{command}</Command>
        </>
      }
      positioning={{
        placement: 'right',
      }}
      openDelay={1000}
      portalled
    >
      <Sidebar.NavItem {...rest}>
        <NavLink
          to={to}
          params={params}
          activeProps={{
            'data-active': true,
          }}
          activeOptions={activeOptions}
        >
          {icon}

          <Box as="span" lineClamp={1}>
            {label}
          </Box>

          {typeof badge !== 'undefined' ? (
            <Badge borderRadius="sm" ms="auto" px="1.5" bg="none">
              {badge}
            </Badge>
          ) : null}
        </NavLink>
      </Sidebar.NavItem>
    </Tooltip>
  )
}

const NavLink = createLink(Sidebar.NavButton)
