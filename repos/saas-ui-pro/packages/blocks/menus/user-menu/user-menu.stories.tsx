import * as React from 'react'

import type { Meta } from '@storybook/react-vite'

import { UserMenu } from './user-menu'

export default {
  title: 'Blocks/Menus/UserMenu',
} as Meta

export const Default = () => <UserMenu />
