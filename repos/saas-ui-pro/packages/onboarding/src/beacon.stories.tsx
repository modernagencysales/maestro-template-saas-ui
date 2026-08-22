import { Button, Container, VStack } from '@chakra-ui/react'
import { Meta } from '@storybook/react-vite'

import { Beacon } from '.'

const meta: Meta = {
  title: 'Components/Onboarding/Beacon',
  component: Beacon,
  parameters: {
    controls: { expanded: true },
  },
  args: {},
  decorators: [
    (Story) => {
      return (
        <Container>
          <Story />
        </Container>
      )
    },
  ],
}
export default meta

export const Basic = {}

export const ColorScheme = {
  args: {
    colorPalette: 'green',
  },
}

export const Sizes = () => {
  return (
    <VStack gap="8">
      <Beacon size="xs" colorPalette="primary" />
      <Beacon size="sm" colorPalette="cyan" />
      <Beacon size="md" colorPalette="blue" />
      <Beacon size="lg" />
    </VStack>
  )
}

export const WithButton = () => {
  return (
    <Button position="relative" variant="surface">
      Changelog{' '}
      <Beacon
        size="sm"
        colorPalette="accent"
        position="absolute"
        top="-2px"
        right="-2px"
      />
    </Button>
  )
}
