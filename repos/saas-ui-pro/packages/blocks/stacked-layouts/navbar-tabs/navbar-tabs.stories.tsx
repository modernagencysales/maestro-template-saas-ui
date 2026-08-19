import * as React from 'react'

import { Skeleton, SkeletonText, Stack } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import * as Page from '#registry/default/ui/page/page'

import { NavbarTabs } from './navbar-tabs'

export default {
  title: 'Blocks/StackedLayouts/NavbarTabs',
} as Meta

export const Default = () => (
  <NavbarTabs>
    <Page.Root>
      <Page.Body overflow="visible">
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
  </NavbarTabs>
)
