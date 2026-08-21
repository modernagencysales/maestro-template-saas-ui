'use client'

import * as React from 'react'

import {
  Button,
  ButtonGroup,
  DataList,
  Portal,
  useBreakpointValue,
} from '@chakra-ui/react'
import { ResizeHandle, Resizer, SplitPage } from '@saas-ui-pro/react'
import { EmptyState, Page, Popover, Switch } from '@saas-ui/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LuInbox, LuSlidersHorizontal } from 'react-icons/lu'

import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'
import { useOpenState } from '#hooks/use-open-state.ts'

import { UpdatesList } from './components/updates-list'
import { getReviewNotifications } from './updates-adapter'

export function UpdatesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: {
    workspace: string
    id?: string
  }
}) {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery({
    queryKey: ['Notifications'],
    queryFn: getReviewNotifications,
  })

  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    { fallback: 'base' },
  )
  const { open, setOpen } = useOpenState({
    defaultOpen: !!params.id,
  })
  const [width, setWidth] = React.useState(280)

  React.useEffect(() => {
    if (!params.id && !isMobile) {
      const firstItem = data?.notifications[0]
      if (firstItem) {
        navigate({
          to: '/$workspace/updates/$id',
          params: {
            workspace: params.workspace,
            id: firstItem.contact.id,
          },
          replace: true,
        })
      }
    }
  }, [data, isMobile, navigate, params.id, params.workspace])

  React.useEffect(() => {
    if (params.id) setOpen(true)
  }, [isMobile, params.id, setOpen])

  const [visibleProps, setVisibleProps] = React.useState<string[]>([])
  const notificationCount = data?.notifications?.length || 0

  /* eslint-disable template/saas-ui-semantic-colors -- preserves the pinned Pro demo selected-state treatment. */
  const displayProperties = (
    <ButtonGroup>
      {['id'].map((id) => {
        const checked = visibleProps.includes(id)
        return (
          <Button
            key={id}
            value={id}
            data-selected={checked ? 'true' : undefined}
            variant="surface"
            size="xs"
            mb="1"
            me="1"
            color="fg.muted"
            _checked={{ color: 'fg', bg: 'whiteAlpha.200' }}
            onClick={() => {
              setVisibleProps((previous) =>
                checked
                  ? previous.filter((property) => property !== id)
                  : [...previous, id],
              )
            }}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </Button>
        )
      })}
    </ButtonGroup>
  )
  /* eslint-enable template/saas-ui-semantic-colors */

  const toolbar = (
    <ButtonGroup justifyContent="flex-end">
      <Popover.Root size="sm" positioning={{ placement: 'bottom-start' }}>
        <Popover.Trigger asChild>
          <Button variant="surface" size="xs">
            <LuSlidersHorizontal />
            Display
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Content maxW="260px" zIndex="layer-2">
            <Popover.Body borderBottomWidth="1px">
              <DataList.Root orientation="horizontal">
                <DataList.Item>
                  <DataList.ItemLabel>Show snoozed</DataList.ItemLabel>
                  <DataList.ItemValue justifyContent="flex-end">
                    <Switch size="sm" defaultChecked={false} />
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Show read</DataList.ItemLabel>
                  <DataList.ItemValue justifyContent="flex-end">
                    <Switch size="sm" defaultChecked={false} />
                  </DataList.ItemValue>
                </DataList.Item>
              </DataList.Root>
            </Popover.Body>
            <Popover.Body>
              <DataList.Root orientation="vertical">
                <DataList.Item>
                  <DataList.ItemLabel>Display properties</DataList.ItemLabel>
                  <DataList.ItemValue>{displayProperties}</DataList.ItemValue>
                </DataList.Item>
              </DataList.Root>
            </Popover.Body>
          </Popover.Content>
        </Portal>
      </Popover.Root>
    </ButtonGroup>
  )

  const emptyState = (
    <EmptyState
      icon={<LuInbox />}
      title="Inbox zero"
      description="Nothing to do here"
      height="100%"
    />
  )

  return (
    <SplitPage
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <Resizer
        defaultWidth={width}
        onResize={({ width: nextWidth }) => setWidth(nextWidth)}
        enabled={!isMobile}
      >
        <Page.Root
          as="div"
          borderRightWidth={{ base: 0, md: '1px' }}
          minWidth="280px"
          maxW={{ base: '100%', md: '640px' }}
          position="relative"
          flex={{ base: '1', md: 'unset' }}
        >
          <Page.Header
            title="Updates"
            nav={<SidebarToggleButton />}
            actions={toolbar}
          />
          <Page.Body p="0">
            {!notificationCount && isMobile ? (
              emptyState
            ) : (
              <UpdatesList
                items={data?.notifications || []}
                workspace={params.workspace}
              />
            )}
          </Page.Body>
          <ResizeHandle />
        </Page.Root>
      </Resizer>
      <>{children}</>
    </SplitPage>
  )
}
