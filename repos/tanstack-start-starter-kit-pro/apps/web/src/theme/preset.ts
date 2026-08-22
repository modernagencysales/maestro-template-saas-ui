import { createSystem, defineConfig, defineRecipe } from '@chakra-ui/react'
import { defaultConfig } from '@saas-ui/chakra-preset'

import { colors } from './semantic-tokens/colors'

const buttonRecipe = defineRecipe({
  variants: {
    variant: {
      primary:
        defaultConfig.theme?.recipes?.button?.variants?.variant?.glass ?? {},
      secondary:
        defaultConfig.theme?.recipes?.button?.variants?.variant?.surface ?? {},
      tertiary:
        defaultConfig.theme?.recipes?.button?.variants?.variant?.ghost ?? {},
    },
  },
  defaultVariants: {
    variant: 'secondary',
  },
})

const config = defineConfig({
  theme: {
    recipes: {
      button: buttonRecipe,
    },
    semanticTokens: {
      colors,
    },
  },
})

export const system = createSystem(defaultConfig, config)
