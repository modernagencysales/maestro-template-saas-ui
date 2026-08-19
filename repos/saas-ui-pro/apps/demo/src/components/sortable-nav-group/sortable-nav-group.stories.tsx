import type { Meta } from '@storybook/react'

import * as Sidebar from '#ui/sidebar/sidebar'

import { SortableNavGroup, SortableNavItem } from './'

export default {
  title: 'Components/SortableNavGroup',
  component: SortableNavGroup,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Sidebar.Provider>
        <Sidebar.Root height="100vh">
          <Sidebar.Body>
            <Story />
          </Sidebar.Body>
        </Sidebar.Root>
      </Sidebar.Provider>
    ),
  ],
} as Meta

export const Default = {
  render: () => (
    <SortableNavGroup items={['home', 'users']}>
      <SortableNavItem id="home">Home</SortableNavItem>
      <SortableNavItem id="users">Users</SortableNavItem>
    </SortableNavGroup>
  ),
  args: {},
}
