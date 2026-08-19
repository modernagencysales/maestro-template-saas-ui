import { Meta, StoryObj } from '@storybook/react'

import { LinkButton, LinkButtonProps } from './'

export default {
  title: 'Components/LinkButton',
  component: LinkButton,
} as Meta

type Story = StoryObj<LinkButtonProps>

export const Default: Story = {
  args: {
    children: 'Home',
  },
}
