import type { Meta } from '@storybook/react-vite'

import { Sidebar1 } from './sidebar1'

export default {
  title: 'Blocks/SidebarLayouts/Sidebar1',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [(Story) => <Story />],
} as Meta

export const Default = () => {
  return <Sidebar1 />
}
