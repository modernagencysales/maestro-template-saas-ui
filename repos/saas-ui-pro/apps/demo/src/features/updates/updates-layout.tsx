'use client'

import * as React from 'react'

import {
  Button,
  ButtonGroup,
  DataList,
  Portal,
  useBreakpoint,
  useDisclosure,
} from '@chakra-ui/react'
import { ResizeHandle, Resizer, SplitPage } from '@saas-ui-pro/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { LuInbox, LuSlidersHorizontal } from 'react-icons/lu'

import * as Page from '#ui/page/page'
import * as Popover from '#ui/popover/popover'
import { getNotifications } from '#api'
import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'
import { EmptyState } from '#ui/empty-state/empty-state'
import { Switch } from '#ui/switch/switch'

import { UpdatesList } from './components/updates-list'

export function UpdatesLayout({
  children,
}: {
  children: React.ReactNode
  params: {
    workspace: string
  }
}) {
  // Need to use useParams here because the params are not available in the layout params
  const params = useParams()

  const router = useRouter()

  const { data } = useSuspenseQuery({
    queryKey: ['Notifications'],
    queryFn: () => getNotifications(),
  })

  const breakpoint = useBreakpoint({
    breakpoints: ['base', 'lg'],
    fallback: 'base',
    ssr: false,
  })

  const isMobile = breakpoint === 'base'
  const { open, onOpen, onClose } = useDisclosure({
    defaultOpen: !!params.id,
  })

  const [width, setWidth] = React.useState(280)

  React.useEffect(() => {
    if (!params.id && !isMobile) {
      const firstItem = data?.notifications[0]
      if (firstItem) {
        // redirect to the first inbox notification if it's available.
        router.replace(`/${params.workspace}/updates/${firstItem.contact.id}`)
      }
    }
  }, [router, data, isMobile])

  React.useEffect(() => {
    if (params.id) {
      onOpen()
    }
    // the isMobile dep is needed so that the SplitPage
    // will open again when the screen size changes to lg
  }, [params.id, isMobile])

  const [visibleProps, setVisibleProps] = React.useState<string[]>([])

  const notificationCount = data?.notifications?.length || 0

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
              setVisibleProps((prev) =>
                checked ? prev.filter((p) => p !== id) : [...prev, id],
              )
            }}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </Button>
        )
      })}
    </ButtonGroup>
  )

  const toolbar = (
    <ButtonGroup justifyContent="flex-end">
      <Popover.Root
        size="sm"
        positioning={{
          placement: 'bottom-start',
        }}
      >
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
    <SplitPage open={open} onOpen={onOpen} onClose={onClose} mobile={isMobile}>
      <Resizer
        defaultWidth={width}
        onResize={({ width }) => setWidth(width)}
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
              <UpdatesList items={data?.notifications || []} />
            )}
          </Page.Body>
          <ResizeHandle />
        </Page.Root>
      </Resizer>
      <>{children}</>
    </SplitPage>
  )
}
