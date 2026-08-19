import * as React from 'react'

import { Skeleton, SkeletonText, Stack } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import * as Page from '#registry/default/ui/page/page'

import { NavbarBranded } from './navbar-branded'

export default {
  title: 'Blocks/StackedLayouts/NavbarBranded',
} as Meta

export const Default = () => (
  <NavbarBranded>
    <Page.Root>
      <Page.Header title="Contacts"></Page.Header>
      <Page.Body>
        <Stack gap="4" mb="14" pt="10">
          <Skeleton width="100px" height="24px" />
          <SkeletonText />
        </Stack>
        <Stack direction="row" gap="8" mb="14">
          <Stack gap="4" flex="1">
            <Skeleton width="100px" height="20px" />
            <SkeletonText />
          </Stack>
          <Stack gap="4" flex="1">
            <Skeleton width="100px" height="20px" />
            <SkeletonText />
          </Stack>
        </Stack>
        <Stack direction="row" gap="8" mb="14">
          <Stack gap="4" flex="1">
            <Skeleton width="100px" height="20px" />
            <SkeletonText />
          </Stack>
          <Stack gap="4" flex="1">
            <Skeleton width="100px" height="20px" />
            <SkeletonText />
          </Stack>
        </Stack>
        <Stack direction="row" gap="8">
          <Stack gap="4" flex="1">
            <Skeleton width="100px" height="20px" />
            <SkeletonText />
          </Stack>
          <Stack gap="4" flex="1">
            <Skeleton width="100px" height="20px" />
            <SkeletonText />
          </Stack>
        </Stack>
      </Page.Body>
    </Page.Root>
  </NavbarBranded>
)
