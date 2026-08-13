import { Meta } from '@storybook/react-vite'

import { Logo, LogoIcon } from './'

export default {
  title: 'Components/Logo',
  component: Logo,
} as Meta

export const Default = {
  args: {},
}

export const Icon = {
  render: () => <LogoIcon />,
}
