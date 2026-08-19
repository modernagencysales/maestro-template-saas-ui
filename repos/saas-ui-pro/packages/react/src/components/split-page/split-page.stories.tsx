import * as React from 'react'

import {
  Box,
  BoxProps,
  Button,
  Text,
  chakra,
  useBreakpointValue,
} from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'
import { FiCode, FiFilter } from 'react-icons/fi'

import * as GridList from '#registry/default/ui/grid-list/grid-list'
import { AppShell } from '#registry/default/ui/app-shell/app-shell'
import { Avatar } from '#registry/default/ui/avatar/avatar'
import { BackButton } from '#registry/default/ui/back-button/index.ts'
import { EmptyState } from '#registry/default/ui/empty-state/empty-state'
import { Page } from '#registry/default/ui/page/index.ts'

import { ResizeHandle, type ResizeHandler, Resizer } from '../resize/index.ts'
import { SplitPage, useSplitPage } from './index.ts'

export default {
  title: 'Components/Layout/SplitPage',
  decorators: [
    (Story) => (
      <AppShell borderWidth="1px" height="calc(100vh - 40px)">
        <Story />
      </AppShell>
    ),
  ],
} as Meta

const List = () => (
  <GridList.Root>
    <GridList.Item>
      <GridList.Cell width="14">
        <Avatar name="Elliot Alderson" size="sm" />
      </GridList.Cell>
      <GridList.Cell flex="1">
        <Text fontWeight="bold">A bug is never just a mistake.</Text>
        <Text fontSize="sm" color="muted" lineClamp={2}>
          <Text as="span" color="app-text">
            Elliot Alderson
          </Text>{' '}
          — It represents something bigger. An error of thinking that makes you
          who you are.
        </Text>
      </GridList.Cell>
    </GridList.Item>
    <GridList.Item>
      <GridList.Cell width="14">
        <Avatar name="Tyrell Wellick" size="sm" />
      </GridList.Cell>
      <GridList.Cell flex="1">
        <Text fontWeight="bold">Hi</Text>
        <Text fontSize="sm" color="muted" lineClamp={2}>
          <Text as="span" color="app-text">
            Tyrell Wellick
          </Text>{' '}
          — Unfortunately, we’re all human. Except me, of course.
        </Text>
      </GridList.Cell>
    </GridList.Item>
  </GridList.Root>
)

const Content = (props: BoxProps) => {
  return (
    <Box {...props}>
      <Text>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed nibh
        sit amet nulla ultricies vehicula. Proin consequat auctor vestibulum.
        Phasellus sit amet fringilla erat, nec placerat dui. In iaculis ex non
        lacus dictum pellentesque. Pellentesque malesuada ipsum ex, ac ultricies
        nisi ornare non. Suspendisse potenti. Vestibulum hendrerit tellus elit,
        eget suscipit odio luctus ut. Nunc aliquam urna arcu, sit amet ultrices
        nunc malesuada id. Nam semper ante lectus, id egestas dolor tempus non.
      </Text>
    </Box>
  )
}

export const Basic = {
  render: () => (
    <SplitPage>
      <Page.Root borderRightWidth="1px" width="30%" maxW="300px">
        <Page.Header title="Inbox" />
        <Page.Body p="0">
          <List />
        </Page.Body>
      </Page.Root>
      <EmptyState title="Inbox zero" />
    </SplitPage>
  ),
}

export const WithContent = {
  render: () => (
    <SplitPage>
      <Page.Root borderRightWidth="1px" width="30%" maxW="300px">
        <Page.Header title="Inbox" />
        <Page.Body p="0">
          <List />
        </Page.Body>
      </Page.Root>
      <Page.Root>
        <Page.Header
          title="Elliot Alderson"
          description="A bug is never just a mistake"
        />
        <Page.Body>
          <Content />
        </Page.Body>
      </Page.Root>
    </SplitPage>
  ),
}

export const WithToolbar = {
  render: () => (
    <SplitPage>
      <Page.Root borderRightWidth="1px" width="30%" maxW="300px">
        <Page.Header
          title="Inbox"
          actions={
            <Button size="sm" variant="outline" aria-label="Filter">
              <FiFilter />
            </Button>
          }
        />
        <Page.Body p="0">
          <List />
        </Page.Body>
      </Page.Root>
      <Page.Root>
        <Page.Header
          title="Elliot Alderson"
          description="A bug is never just a mistake"
        />
        <Page.Body>
          <Content />
        </Page.Body>
      </Page.Root>
    </SplitPage>
  ),
}

export const Resizable = {
  render: () => {
    const [width, setWidth] = React.useState(300)

    const onResize: ResizeHandler = ({ width }) => {
      setWidth(width)
    }

    return (
      <SplitPage>
        <Resizer
          defaultWidth={width}
          onResize={onResize}
          enabled={useBreakpointValue(
            { base: false, lg: true },
            { fallback: 'lg' },
          )}
        >
          <Page.Root
            borderRightWidth="1px"
            minWidth="220px"
            maxW="600px"
            flex="none"
            position="relative"
          >
            <Page.Header
              title="Inbox"
              actions={
                <Button size="sm" variant="outline" aria-label="Filter">
                  <FiFilter />
                </Button>
              }
            />
            <Page.Body p="0">
              <List />
            </Page.Body>
            <ResizeHandle />
          </Page.Root>
        </Resizer>
        <Page.Root>
          <Page.Header
            title="Elliot Alderson"
            description="A bug is never just a mistake"
          />
          <Page.Body>
            <Content />
          </Page.Body>
        </Page.Root>
      </SplitPage>
    )
  },
}

const breakpoints = { base: true, lg: false }

const ResponsiveContent = () => {
  const { onClose } = useSplitPage()

  const isMobile = useBreakpointValue(breakpoints)
  const nav = isMobile && <BackButton onClick={onClose} ms="-2" />

  return (
    <Page.Root>
      <Page.Header
        title="Elliot Alderson"
        description="A bug is never just a mistake"
        nav={nav}
      />
      <Page.Body>
        <Content />
      </Page.Body>
    </Page.Root>
  )
}

const ResponsiveList = () => {
  const { onOpen } = useSplitPage()
  return (
    <GridList.Root>
      <GridList.Item onClick={onOpen}>Responsive item</GridList.Item>
    </GridList.Root>
  )
}

export const Responsive = {
  render: () => {
    return (
      <SplitPage defaultOpen={false} breakpoint="lg">
        <Page.Root
          borderRightWidth="1px"
          width="30%"
          maxW={{ base: 'full', lg: '300px' }}
        >
          <Page.Header title="Inbox" />
          <Page.Body p="0">
            <ResponsiveList />
          </Page.Body>
        </Page.Root>
        <ResponsiveContent />
      </SplitPage>
    )
  },
}

const Queries = () => {
  const { onOpen } = useSplitPage()
  return (
    <GridList.Root>
      <GridList.Item onClick={() => onOpen}>
        <GridList.Cell color="fg.muted">
          <FiCode />
        </GridList.Cell>
        <GridList.Cell px="2" flex="1">
          Get all users
        </GridList.Cell>
      </GridList.Item>
    </GridList.Root>
  )
}

export const Vertical = {
  render: () => {
    const breakpoints = { base: false }

    return (
      <SplitPage
        defaultOpen={false}
        breakpoints={breakpoints}
        orientation="vertical"
      >
        <Page.Root borderBottomWidth="1px" height="30%">
          <Page.Header title="Queries" />
          <Page.Body p="0">
            <Queries />
          </Page.Body>
        </Page.Root>
        <Page.Root>
          <Page.Header title="Queries" />
          <Page.Body p="0">
            <chakra.div
              _focus={{ outline: 0 }}
              minH="100%"
              p="4"
              contentEditable
              dangerouslySetInnerHTML={{ __html: 'SELECT * FROM users' }}
            />
          </Page.Body>
        </Page.Root>
      </SplitPage>
    )
  },
}
