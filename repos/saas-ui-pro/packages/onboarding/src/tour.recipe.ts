import { tourAnatomy } from '@ark-ui/react'
import { defineSlotRecipe } from '@chakra-ui/react'

export const tourSlotRecipe = defineSlotRecipe({
  slots: tourAnatomy.keys(),
  base: {
    content: {
      '--tour-content-bg': 'colors.bg.overlay',
      '--tour-dialog-z-index': 'zIndex.popover',
      zIndex: 'var(--tour-dialog-z-index)',
      bg: 'var(--tour-content-bg)',
      position: 'relative',
      _focus: {
        outline: 0,
      },
    },
    arrow: {
      '--arrow-size': 'var(--sizes-3)',
      '--arrow-background': 'var(--tour-content-bg)',
    },
    arrowTip: {
      borderTopWidth: '1px',
      borderLeftWidth: '1px',
    },
    backdrop: {
      layerStyle: 'backdrop',
      zIndex: 'layer-4',
      _open: {
        animationName: 'fade-in',
        animationDuration: 'slow',
      },
      _closed: {
        animationName: 'fade-out',
        animationDuration: 'moderate',
      },
    },
    title: {
      fontWeight: 'medium',
      textStyle: 'lg',
    },
    control: {
      display: 'flex',
      gap: '2',
      justifyContent: 'flex-end',
    },
    description: {
      color: 'fg.muted',
      textStyle: 'sm',
    },
    closeTrigger: {
      position: 'absolute',
      top: '3',
      right: '3',
    },
    positioner: {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 'modal!',
      "&[data-type='dialog']": {
        inset: 0,
        position: 'fixed',
      },
      '&[data-type="tooltip"]': {
        position: 'absolute',
      },
    },
    progressText: {
      textStyle: 'sm',
      color: 'fg.muted',
    },
    spotlight: {
      borderWidth: '3px',
      borderStyle: 'solid',
      borderColor: 'colorPalette.default',
      zIndex: 'modal',
    },
  },
  variants: {
    variant: {
      default: {
        content: {
          layerStyle: 'overlay',
          '--tour-content-bg': 'colors.bg.overlay',
        },
      },
      solid: {
        content: {
          '--tour-content-bg': 'colors.colorPalette.solid',
        },
      },
    },
    size: {
      sm: {
        content: {
          minWidth: 'xs',
          p: '3',
        },
      },
      md: {
        content: {
          minWidth: 'sm',
          p: '4',
        },
      },
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})
