import * as React from 'react'

import { ChakraProvider, chakra } from '@chakra-ui/react'
import '@fontsource-variable/inter'
import { defaultSystem } from '@saas-ui/chakra-preset'
import { StoryContext } from '@storybook/react-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

export const parameters = {
  viewport: {
    options: INITIAL_VIEWPORTS,
  },
  options: {
    storySort: {
      order: ['Getting Started', ['Welcome'], 'Components', 'Themes'],
    },
  },
}

/**
 * Add global context for RTL-LTR switching
 */
export const globalTypes = {
  direction: {
    name: 'Direction',
    description: 'Direction for layout',
    defaultValue: 'LTR',
    toolbar: {
      icon: 'globe',
      items: ['LTR', 'RTL'],
    },
  },
  theme: {
    name: 'Theme',
    title: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'pro',
    toolbar: {
      icon: 'paintbrush',
      items: ['pro', 'glass', 'chakra'],
    },
  },
  colorMode: {
    name: 'ColorMode',
    description: 'Color mode',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      items: ['light', 'dark'],
    },
  },
}

const ColorModeToggle = ({ colorMode }) => {
  // const { setColorMode } = useColorMode()
  // React.useEffect(() => {
  //   setColorMode?.(colorMode)
  // }, [colorMode])
  // return null
}

const withChakra = (StoryFn: () => React.ReactNode, context: StoryContext) => {
  const { theme: themeId, colorMode } = context.globals

  const { direction } = context.globals
  const dir = direction.toLowerCase()

  // const getTheme = React.useCallback(() => {
  //   switch (themeId) {
  //     // case 'glass':
  //     //   return glassTheme
  //     case 'chakra':
  //       return {}
  //     case 'pro':
  //     default:
  //       // return proConfig
  //   }
  // }, [themeId])

  const story = (
    <chakra.div dir={dir} id="story-wrapper" height="100%">
      <StoryFn />
    </chakra.div>
  )

  if (context.parameters.saasProvider === false) {
    return story
  }

  // const theme = context.parameters.theme || getTheme()
  return (
    <ChakraProvider value={defaultSystem}>
      {/* <ColorModeToggle colorMode={colorMode} /> */}
      {story}
    </ChakraProvider>
  )
}

export const decorators = [withChakra]
