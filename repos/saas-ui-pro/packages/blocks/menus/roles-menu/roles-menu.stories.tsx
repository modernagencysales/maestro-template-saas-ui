import * as React from 'react'

import type { Meta } from '@storybook/react-vite'

import { RolesMenu } from './roles-menu'

export default {
  title: 'Blocks/Menus/RolesMenu',
} as Meta

export const Default = () => <RolesMenu defaultValue="user" />
