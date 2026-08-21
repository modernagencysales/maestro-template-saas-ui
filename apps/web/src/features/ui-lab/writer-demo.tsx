import { useState } from 'react'

import {
  Button,
  ButtonGroup,
  Card,
  ChakraProvider,
  Heading,
  IconButton,
  SimpleGrid,
  Text,
  createSystem,
} from '@chakra-ui/react'
import { defaultConfig } from '@saas-ui/chakra-preset'
import { SegmentedControl } from '@saas-ui/react'
import { Reorder } from 'framer-motion'
import {
  RiFolder2Line,
  RiInbox2Line,
  RiKanbanView,
  RiListView,
  RiSearch2Line,
  RiSidebarFoldLine,
} from 'react-icons/ri'

import * as Page from '#components/ui/page/page'
import * as Sidebar from '#components/ui/sidebar/sidebar'
import { AppShell } from '#components/ui/app-shell/app-shell'

const stone = defaultConfig.theme?.tokens?.colors?.stone

if (!stone) {
  throw new Error('The Chakra preset is missing the stone color scale.')
}

const system = createSystem(defaultConfig, {
  globalCss: {
    ':root': {
      '--radius-control': '4',
    },
  },
  theme: {
    tokens: {
      colors: {
        gray: stone,
      },
    },
  },
})

export function WriterDemo() {
  const toolbar = (
    <ButtonGroup justifyContent="flex-end">
      <Button size="xs">Share</Button>
      <SegmentedControl
        size="xs"
        defaultValue="list"
        items={[
          { label: <RiListView />, value: 'list' },
          { label: <RiKanbanView />, value: 'kanban' },
        ]}
      />
    </ButtonGroup>
  )

  return (
    <ChakraProvider value={system}>
      <Sidebar.Provider>
        <AppShell sidebar={<WriterSidebar />} bg="bg.subtle" minH="640px">
          <Page.Root bg="bg.subtle">
            <Page.Header title="Research" actions={toolbar} border="0" />
            <Page.Body>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={4}>
                <Card.Root
                  minH="200px"
                  bg="transparent"
                  variant="outline"
                  borderStyle="dotted"
                  cursor="button"
                  _hover={{
                    bg: 'bg.emphasized/10',
                  }}
                >
                  <Card.Body alignItems="center" justifyContent="center">
                    <Text textStyle="sm">New document</Text>
                  </Card.Body>
                </Card.Root>
                <Card.Root>
                  <Card.Header>
                    <Card.Title textStyle="sm">Market analysis</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <Text textStyle="xs" color="fg.muted">
                      Research findings, market analysis, and technical
                      documentation for SaaS applications.
                    </Text>
                  </Card.Body>
                </Card.Root>
                <Card.Root>
                  <Card.Header>
                    <Card.Title textStyle="sm">Competitors</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <Text textStyle="xs" color="fg.muted" lineClamp={10}>
                      Analysis of key competitors in the document collaboration
                      space: <br />
                      <br />
                      • Notion - Known for its all-in-one workspace approach and
                      block-based editor <br />
                      • Google Docs - Dominant player with real-time
                      collaboration features
                      <br />
                      • Coda - Combines docs and spreadsheets with building
                      blocks <br /> • Craft - Modern native writing experience
                      with excellent organization <br /> • Dropbox Paper - Clean
                      collaborative document editor with rich media support Key
                      differentiators include pricing models, offline
                      capabilities, and integration ecosystems. Most competitors
                      focus on team collaboration features.
                    </Text>
                  </Card.Body>
                </Card.Root>
              </SimpleGrid>
            </Page.Body>
          </Page.Root>
        </AppShell>
      </Sidebar.Provider>
    </ChakraProvider>
  )
}

function WriterSidebar() {
  const [projects, setProjects] = useState([
    { label: 'Research', value: 'research' },
    { label: 'SaaS', value: 'saas' },
    { label: 'Marketing', value: 'marketing' },
  ])

  return (
    <Sidebar.Root borderRightWidth="1px" width="220px">
      <Sidebar.Header alignItems="center">
        <Heading as="h1" size="sm" flex="1" px="2">
          Writer
        </Heading>

        <Sidebar.Trigger>
          <IconButton aria-label="Toggle sidebar" variant="ghost" size="xs">
            <RiSidebarFoldLine />
          </IconButton>
        </Sidebar.Trigger>
      </Sidebar.Header>
      <Sidebar.Body py="1">
        <Sidebar.Group>
          <Sidebar.GroupContent>
            <Sidebar.NavItem>
              <Sidebar.NavButton>
                <RiSearch2Line />
                Search
              </Sidebar.NavButton>
            </Sidebar.NavItem>
            <Sidebar.NavItem>
              <Sidebar.NavButton>
                <RiInbox2Line />
                Inbox
              </Sidebar.NavButton>
            </Sidebar.NavItem>
          </Sidebar.GroupContent>
        </Sidebar.Group>

        <Sidebar.Group>
          <Sidebar.GroupHeader>
            <Sidebar.GroupTitle>Projects</Sidebar.GroupTitle>
          </Sidebar.GroupHeader>
          <Sidebar.GroupContent>
            <Reorder.Group values={projects} onReorder={setProjects}>
              {projects.map((project) => (
                <Reorder.Item key={project.value} value={project}>
                  <Sidebar.NavItem>
                    <Sidebar.NavButton px="2">
                      <RiFolder2Line />
                      {project.label}
                    </Sidebar.NavButton>
                  </Sidebar.NavItem>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      </Sidebar.Body>
    </Sidebar.Root>
  )
}
