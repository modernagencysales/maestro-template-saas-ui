'use client'

import * as React from 'react'

import {
  Badge,
  Box,
  Collapsible,
  Spacer,
  Text,
  useControllableState,
} from '@chakra-ui/react'
import { ResizeHandle, ResizeHandler, Resizer } from '@saas-ui-pro/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  LuBuilding,
  LuChartNoAxesCombined,
  LuPlus,
  LuSearch,
  LuSquareUser,
  LuWorkflow,
  LuZap,
} from 'react-icons/lu'

import * as Sidebar from '#ui/sidebar/sidebar'
import { Tags, User, getTags } from '#api'
import { useHelpCenter } from '#components/help-center'
import { InviteDialog } from '#components/invite-dialog'
import { useModals } from '#components/modals'
import {
  SortableNavGroup,
  SortableNavItem,
} from '#components/sortable-nav-group'
import { useActivePath } from '#features/common/hooks/use-active-path'
import { usePath } from '#features/common/hooks/use-path'
import { useHotkeysShortcut } from '#features/common/lib/hotkeys'
import { IconButton } from '#ui/icon-button/icon-button'
import { useSidebar } from '#ui/sidebar/sidebar.context'
import { Tooltip } from '#ui/tooltip/tooltip'

import { useCurrentUser } from '../hooks/use-current-user'
import { BillingStatus } from './billing-status'
import { WorkspacesMenu } from './workspaces-menu'

export interface AppSidebarProps extends Sidebar.RootProps {}

export const AppSidebar: React.FC<AppSidebarProps> = (props) => {
  const user = useCurrentUser()
  const modals = useModals()
  const router = useRouter()

  const searchPath = usePath('/search')

  const help = useHelpCenter()

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
          <WorkspacesMenu />
          <Spacer />
          <IconButton
            variant="ghost"
            size="sm"
            rounded="full"
            aria-label="Search"
            onClick={() => router.push(searchPath)}
          >
            <LuSearch />
          </IconButton>
        </Sidebar.Header>

        <Sidebar.Body>
          <Sidebar.Group>
            <AppSidebarLink
              href={usePath('updates')}
              active={useActivePath('updates', { end: false })}
              label="Updates"
              badge={2}
              icon={<LuZap />}
              hotkey="navigation.updates"
            />
            <AppSidebarLink
              href={usePath('contacts')}
              active={useActivePath('contacts', { end: false })}
              label="People"
              icon={<LuSquareUser />}
              hotkey="navigation.people"
            />
            <AppSidebarLink
              href={usePath('companies')}
              active={useActivePath('companies', { end: false })}
              label="Companies"
              icon={<LuBuilding />}
              hotkey="navigation.companies"
            />
            <AppSidebarLink
              href={usePath('workflows')}
              active={useActivePath('workflows', { end: false })}
              label="Workflows"
              icon={<LuWorkflow />}
              hotkey="navigation.workflows"
            />
            <AppSidebarLink
              href={usePath('reports')}
              label="Reports"
              icon={<LuChartNoAxesCombined />}
              hotkey="navigation.reports"
            />
          </Sidebar.Group>

          <AppSidebarTags user={user} />

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
                    onClick={() =>
                      modals.open(InviteDialog, {
                        title: 'Invite people',
                        onInvite: async () => {
                          // TODO: handle invite
                        },
                      })
                    }
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
              <IconButton
                onClick={() => help.open()}
                variant="outline"
                rounded="full"
                aria-label="Help and support"
                size="xs"
                bg="bg.panel"
              >
                ?
              </IconButton>
            </Sidebar.NavItem>
          </Sidebar.Group>
        </Sidebar.Body>

        <Sidebar.Footer asChild>
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

interface AppSidebarlink extends Sidebar.NavButtonProps {
  hotkey: string
  href: string
  label: string
  icon: React.ReactNode
  badge?: React.ReactNode
}

const AppSidebarLink: React.FC<AppSidebarlink> = (props) => {
  const { isMobile, setOpenMobile } = useSidebar()

  const { href, label, hotkey, icon, badge, ...rest } = props
  const { push } = useRouter()
  const active = useActivePath(href)

  const command = useHotkeysShortcut(hotkey, () => {
    push(href)
  })

  return (
    <Tooltip
      content={
        <>
          {label} {command}
        </>
      }
      positioning={{
        placement: 'right',
      }}
      openDelay={200}
      portalled
    >
      <Sidebar.NavItem size="md">
        <Sidebar.NavButton
          active={active}
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false)
            }
          }}
          {...rest}
          asChild
        >
          <Link href={href} prefetch={false}>
            {icon}

            <Box as="span" lineClamp={1}>
              {label}
            </Box>

            {typeof badge !== 'undefined' ? (
              <Badge borderRadius="sm" ms="auto" px="1.5" bg="none" size="sm">
                {badge}
              </Badge>
            ) : null}
          </Link>
        </Sidebar.NavButton>
      </Sidebar.NavItem>
    </Tooltip>
  )
}

const AppSidebarTags = ({ user }: { user: User }) => {
  const queryClient = useQueryClient()
  const query = useParams()

  const userTags = user.workspace?.tags || []

  const mutation = useMutation({
    mutationFn: async (tags: string[]) => {
      /**
       * This just updates the local cache, you should also update the server.
       */
      queryClient.setQueryData<any>(
        ['CurrentUser'],
        (data: { currentUser: User }) => ({
          currentUser: {
            ...data.currentUser,
            workspace: {
              ...data?.currentUser?.workspace,
              tags,
            },
          },
        }),
      )
    },
  })

  const getSortedTags = React.useCallback(
    (tags: Tags) => {
      return userTags
        .map((id) => tags.find((tag) => tag.id === id))
        .filter(Boolean) as Tags
    },
    [userTags],
  )

  const { data } = useQuery({
    queryKey: ['GetTags'],
    queryFn: async () => {
      const data = await getTags()
      setTags(getSortedTags(data?.tags || []))
      return data
    },
  })

  const [sortedTags, setTags] = useControllableState<Tags>({
    defaultValue: getSortedTags(data?.tags || []),
    onChange(tags) {
      if (sortedTags.length) {
        mutation.mutate(tags.map(({ id }) => id))
      }
    },
  })

  const basePath = usePath(`/tag/`)

  if (!sortedTags.length) {
    return null
  }

  return (
    <Collapsible.Root defaultOpen asChild>
      <Sidebar.Group>
        <Collapsible.Trigger asChild>
          <Sidebar.GroupHeader>
            <Sidebar.GroupTitle>Tags</Sidebar.GroupTitle>
          </Sidebar.GroupHeader>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <SortableNavGroup items={sortedTags} onSorted={setTags}>
            {sortedTags.map((tag) => (
              <SortableNavItem key={tag.id} id={tag.id} my="0">
                <Sidebar.NavButton active={query.tag === tag.id} asChild>
                  <Link href={`${basePath}/${tag.id}`}>
                    <Badge
                      bg={tag.color}
                      minW="0"
                      minH="0"
                      p="0"
                      boxSize="2"
                      borderRadius="full"
                      variant="solid"
                    />
                    <Text>{tag.label}</Text>
                    <Sidebar.NavButtonEndElement>
                      <Badge
                        colorPalette="gray"
                        opacity="0.6"
                        borderRadius="full"
                        bg="none"
                        ms="auto"
                        fontWeight="medium"
                        size="sm"
                      >
                        {tag.count}
                      </Badge>
                    </Sidebar.NavButtonEndElement>
                  </Link>
                </Sidebar.NavButton>
              </SortableNavItem>
            ))}
          </SortableNavGroup>
        </Collapsible.Content>
      </Sidebar.Group>
    </Collapsible.Root>
  )
}
