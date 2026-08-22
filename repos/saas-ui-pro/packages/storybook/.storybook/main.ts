import type { StorybookConfig } from '@storybook/react-vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export default {
  stories: [
    {
      directory: '../../',
      files: '*/!(node_modules)/**/*.@(mdx|stories.@(tsx))',
    },
  ],

  core: {
    builder: '@storybook/builder-vite',
  },

  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-links',
  ],

  staticDirs: ['./static'],

  typescript: {
    reactDocgen: false,
  },

  refs: (config, { configType }) => {
    const refs = {
      '@chakra-ui/react': {
        disable: true, // Make sure Chakra gets loaded last
      },

      chakra: {
        title: 'Chakra UI',
        url: 'https://storybook.chakra-ui.com',
      },
    }
    return refs
  },

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
} satisfies StorybookConfig
