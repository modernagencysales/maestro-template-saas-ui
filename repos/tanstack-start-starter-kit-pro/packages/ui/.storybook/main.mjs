import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
export default {
  stories: [
    {
      directory: '../../',
      files: '*/!(node_modules)/**/*.@(stories.@(tsx))',
    },
  ],
  addons: [
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@chromatic-com/storybook'),
  ],
  staticDirs: ['./static'],
  typescript: {
    reactDocgen: false,
  },
  refs: () => {
    const refs = {
      '@chakra-ui/react': {
        disable: true, // Make sure Chakra gets loaded last
      },

      chakra: {
        title: 'Chakra UI',
        url: 'https://storybook.chakra-ui.com',
      },
    }
    return {
      '@saas-ui-pro/react': {
        title: 'Saas UI Pro',
        url: 'https://storybook.saas-ui.pro/',
      },
      '@saas-ui/react': {
        title: 'Saas UI',
        url: 'https://storybook.saas-ui.dev/',
      },
      ...refs,
    }
  },
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
  },
  docs: {},
}

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')))
}
