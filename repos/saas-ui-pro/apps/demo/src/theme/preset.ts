import { createSystem, defineConfig } from '@chakra-ui/react'
import { defaultConfig } from '@saas-ui-pro/react'

const config = defineConfig({
  theme: {
    recipes: {
      button: {
        variants: {
          variant: {
            primary: defaultConfig.theme?.recipes?.button.variants?.glass,
            secondary: defaultConfig.theme?.recipes?.button.variants?.surface,
            tertiary: defaultConfig.theme?.recipes?.button.variants?.ghost,
          },
        },
        defaultProps: {
          variant: 'secondary',
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)

// import { extendTheme } from '@chakra-ui/react'
// import {
//   theme as baseTheme,
//   /* withThemeColors */
// } from '@saas-ui-pro/react'

// // import { theme as glassTheme } from '@saas-ui-pro/theme-glass'
// import { components } from './components'
// import semanticTokens from './foundations/semantic-tokens'

// // import colorScheme from './color-schemes/galaxy'
// // import colorScheme from './color-schemes/earth'

// export const theme = extendTheme(
//   {
//     semanticTokens,
//     components,
//   },
//   /**
//    * Uncomment this to use any of the built-in color schemes.
//    */
//   // withThemeColors(colorScheme),
//   // glassTheme,
//   baseTheme,
// )
