import { Box } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { Sidebar2 } from './sidebar2'

export default {
  title: 'Blocks/SidebarLayouts/Sidebar2',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [(Story) => <Story />],
} as Meta

export const Default = () => (
  <Sidebar2>
    <Box minH="full" bg="bg" />
  </Sidebar2>
)
