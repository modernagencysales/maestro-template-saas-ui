import type { Meta } from '@storybook/react-vite'

import * as Page from '#registry/default/ui/page/page'

import { Sidebar3 } from './sidebar3'

export default {
  title: 'Blocks/SidebarLayouts/Sidebar3',
  parameters: {
    layout: 'fullscreen',
  },
} as Meta

export const Default = () => (
  <Sidebar3>
    <Page.Root>
      <Page.Header title="Overview"></Page.Header>
    </Page.Root>
  </Sidebar3>
)
