import * as React from 'react'

import { Badge, Box, Text } from '@chakra-ui/react'
import { SaasUILogo } from '@saas-ui/assets'
import type { Meta } from '@storybook/react-vite'
import { LuHouse, LuSettings, LuUsers } from 'react-icons/lu'

import * as Page from '#registry/default/ui/page/page'
import * as Sidebar from '#registry/default/ui/sidebar/sidebar'
import { AppShell } from '#registry/default/ui/app-shell/app-shell'

import { SortableNavGroup, SortableNavItem } from './sidebar4'

const meta = {
  title: 'Blocks/SidebarLayouts/Sidebar4',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta

export default meta

const tags = [
  {
    id: 'lead',
    name: 'Lead',
    count: 83,
    color: 'purple.500',
  },
  {
    id: 'customer',
    name: 'Customer',
    count: 210,
    color: 'green.500',
  },
  {
    id: 'partner',
    name: 'Partner',
    count: 12,
    color: 'blue.500',
  },
  {
    id: 'prospect',
    name: 'Prospect',
    count: 0,
  },
]

export const Default = () => {
  const [sortedTags, setTags] = React.useState(tags)
  return (
    <AppShell
      height="600px"
      bg="app-background"
      sidebar={
        <Sidebar.Provider>
          <Sidebar.Root>
            <Sidebar.Header>
              <SaasUILogo width="100px" />
            </Sidebar.Header>
            <Sidebar.Body flex="1" overflowY="auto">
              <Sidebar.Group>
                <Sidebar.NavItem>
                  <Sidebar.NavButton asChild>
                    <a href="#">
                      <LuHouse size="1.2em" /> Home
                    </a>
                  </Sidebar.NavButton>
                </Sidebar.NavItem>
                <Sidebar.NavItem>
                  <Sidebar.NavButton asChild active>
                    <a href="#">
                      <LuUsers size="1.2em" /> Contacts
                    </a>
                  </Sidebar.NavButton>
                </Sidebar.NavItem>
                <Sidebar.NavItem>
                  <Sidebar.NavButton asChild>
                    <a href="#">
                      <LuSettings size="1.2em" /> Settings
                    </a>
                  </Sidebar.NavButton>
                </Sidebar.NavItem>
              </Sidebar.Group>

              <Sidebar.Group>
                <Sidebar.GroupHeader>
                  <Sidebar.GroupTitle>Tags</Sidebar.GroupTitle>
                </Sidebar.GroupHeader>
                <SortableNavGroup
                  title="Tags"
                  items={sortedTags}
                  onSorted={setTags}
                >
                  {sortedTags.map((tag) => (
                    <SortableNavItem key={tag.id} id={tag.id}>
                      <Sidebar.NavButton>
                        <Box
                          bg={tag.color || 'gray.500'}
                          boxSize="2"
                          borderRadius="full"
                        />
                        <Text>{tag.name}</Text>
                        <Badge
                          opacity="0.6"
                          borderRadius="full"
                          bg="none"
                          ms="auto"
                          fontWeight="medium"
                          colorPalette="neutral"
                        >
                          {tag.count}
                        </Badge>
                      </Sidebar.NavButton>
                    </SortableNavItem>
                  ))}
                </SortableNavGroup>
              </Sidebar.Group>
            </Sidebar.Body>
          </Sidebar.Root>
        </Sidebar.Provider>
      }
    >
      <Page.Root>
        <Page.Header title="Overview" />
        <Page.Body />
      </Page.Root>
    </AppShell>
  )
}
