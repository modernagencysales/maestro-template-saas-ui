import { defineSemanticTokens } from '@chakra-ui/react'

export const colors = defineSemanticTokens({
  colors: {
    active: {
      value: '{colors.green.400}',
    },
    pending: {
      value: '{colors.orange.400}',
    },
    tag: {
      gray: {
        value: '{colors.gray.200}',
      },
      red: {
        value: '{colors.red.500}',
      },
      orange: {
        value: '{colors.orange.500}',
      },
      yellow: {
        value: '{colors.yellow.500}',
      },
      green: {
        value: '{colors.green.500}',
      },
      teal: {
        value: '{colors.teal.500}',
      },
      blue: {
        value: '{colors.blue.500} ',
      },
      cyan: {
        value: '{colors.cyan.500}',
      },
      purple: {
        value: '{colors.purple.500}',
      },
      pink: {
        value: '{colors.pink.500}',
      },
    },
  },
})
