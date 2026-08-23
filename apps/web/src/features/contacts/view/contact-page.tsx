'use client'

import * as React from 'react'

import {
  Button,
  ButtonGroup,
  HStack,
  Page,
  Spacer,
  Tabs,
  Tooltip,
  useBreakpointValue,
} from '@saas-ui/react'
import {
  LuActivity,
  LuFile,
  LuListTodo,
  LuPanelRightOpen,
} from 'react-icons/lu'

import { Breadcrumbs } from '#components/breadcrumbs'
import { productShell } from '#config/product-shell'
import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { useOpenState } from '#hooks/use-open-state.ts'

import { ActivitiesPanel } from './activities-panel'
import { ContactSidebar } from './contact-sidebar'
import { contactDetailDataHooks } from '../clients-adapter'

interface ContactPageProps {
  params: {
    workspace: string
    id: string
  }

  /**
   * Additional toolbar items when embedded in another page, eg the inbox
   */
  toolbarItems?: React.ReactNode
  rootLabel?: string
  rootTo?: '/$workspace/contacts' | '/$workspace/inbox'
}

interface ContactPageCompositionProps extends ContactPageProps {
  title: React.ReactNode
  primaryLabel?: string
  primaryIcon?: React.ReactNode
  primaryContent: React.ReactNode
  sidebarContent?: (props: {
    open?: boolean
    onOpenChange: (details: { open: boolean }) => void
  }) => React.ReactNode
  showContactTabs?: boolean
}

export function ContactPage({
  params,
  toolbarItems,
  rootLabel = productShell.labels.contacts,
  rootTo = '/$workspace/contacts',
}: ContactPageProps) {
  const [workspace] = useCurrentWorkspace()

  const { data } = contactDetailDataHooks[productShell.contacts]({
    id: params.id,
    workspaceId: workspace.id,
  })

  if (!data) return null

  return (
    <ContactPageComposition
      params={params}
      toolbarItems={toolbarItems}
      rootLabel={rootLabel}
      rootTo={rootTo}
      title={data?.name}
      primaryContent={<ActivitiesPanel contact={data} />}
      sidebarContent={(sidebarProps) => (
        <ContactSidebar contact={data} {...sidebarProps} />
      )}
      showContactTabs
    />
  )
}

export function ContactPageComposition({
  params,
  toolbarItems,
  rootLabel = productShell.labels.contacts,
  rootTo = '/$workspace/contacts',
  title,
  primaryLabel = 'Activity',
  primaryIcon = <LuActivity />,
  primaryContent,
  sidebarContent,
  showContactTabs = false,
}: ContactPageCompositionProps) {

  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    {
      fallback: undefined,
    },
  )

  const sidebar = useOpenState({
    defaultOpen: true,
  })

  React.useEffect(() => {
    if (isMobile === true) {
      sidebar.setOpen(false)
    }
  }, [isMobile])

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        {
          to: rootTo,
          params: { workspace: params.workspace },
          title: rootLabel,
        },
        { title },
      ]}
    />
  )

  const toolbar = (
    <ButtonGroup gridArea="actions">
      <Spacer />
      {toolbarItems}
      {sidebarContent ? (
        <Tooltip
          content={sidebar.open ? 'Hide details' : 'Show details'}
        >
          <Button onClick={() => sidebar.setOpen(!sidebar.open)}>
            <LuPanelRightOpen />
          </Button>
        </Tooltip>
      ) : null}
    </ButtonGroup>
  )

  return (
    <Page.Root>
      <Page.Header title={breadcrumbs} actions={toolbar} />
      <Page.Body p="0">
        <HStack
          alignItems="stretch"
          width="100%"
          height="100%"
          overflowX="hidden"
          position="relative"
          gap="0"
        >
          <Tabs.Root
            variant="pills"
            size="xs"
            colorPalette="gray"
            defaultValue="primary"
            lazyMount
            flex="1"
            minH="0"
            display="flex"
            flexDirection="column"
          >
            <Tabs.List px="4" py="2" borderBottomWidth="1px">
              <Tabs.Trigger value="primary">
                {primaryIcon} {primaryLabel}
              </Tabs.Trigger>
              {showContactTabs ? (
                <>
                  <Tabs.Trigger value="tasks">
                    <LuListTodo /> Tasks
                  </Tabs.Trigger>
                  <Tabs.Trigger value="files">
                    <LuFile />
                    Files
                  </Tabs.Trigger>
                </>
              ) : null}
            </Tabs.List>
            <Tabs.ContentGroup overflowY="auto" flex="1">
              <Tabs.Content value="primary" p="8">
                {primaryContent}
              </Tabs.Content>
            </Tabs.ContentGroup>
          </Tabs.Root>

          {sidebarContent?.({
            open: sidebar.open,
            onOpenChange: sidebar.onOpenChange,
          })}
        </HStack>
      </Page.Body>
    </Page.Root>
  )
}
