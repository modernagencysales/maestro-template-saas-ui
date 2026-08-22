import { type RecipeVariantProps, defineRecipe } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  55% {
    transform: scale(1.6);
    opacity: 0;
  }
  100% {
    opacity: 0;
  }
`

export const beaconRecipe = defineRecipe({
  base: {
    bg: 'colorPalette.solid',
    borderRadius: 'full',
    h: '4',
    w: '4',
    _before: {
      content: '""',
      display: 'block',
      w: '4',
      h: '4',
      borderRadius: 'full',
      animation: `${pulse} 1s ease-in-out infinite`,
      boxShadow: '0 0 2px 2px',
      color: 'colorPalette.solid',
    },
  },
  variants: {
    size: {
      xs: {
        h: '1',
        w: '1',
        _before: {
          h: '1',
          w: '1',
        },
      },
      sm: {
        h: '2',
        w: '2',
        _before: {
          h: '2',
          w: '2',
        },
      },
      md: {
        h: '3',
        w: '3',
        _before: {
          h: '3',
          w: '3',
        },
      },
      lg: {
        h: '4',
        w: '4',
        _before: {
          h: '4',
          w: '4',
        },
      },
    },
  },
  defaultVariants: {
    size: 'sm',
  },
})

export type BeaconVariantProps = RecipeVariantProps<typeof beaconRecipe>
