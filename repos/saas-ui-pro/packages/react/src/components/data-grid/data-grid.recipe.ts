import {
  type RecipeVariantProps,
  defineSlotRecipe,
  defineStyle,
} from '@chakra-ui/react'

const pinnedLeftStyles = defineStyle({
  position: 'sticky',
  left: 'var(--pinned-left)',
  zIndex: 1,
  bg: 'var(--data-grid-row-bg)',
  '&[data-last]:after': {
    content: '""',
    display: 'block',
    position: 'absolute',
    right: '-4px',
    zIndex: 1,
    top: '-1px',
    bottom: '-1px',
    width: '4px',
    pointerEvents: 'none',
    bgGradient: 'to-r',
    gradientFrom: 'blackAlpha.200',
    gradientTo: 'transparent',
  },
  _before: {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
    pointerEvents: 'none',
  },
  _dark: {
    '&[data-last]:after': {
      my: '1px',
      borderLeft: '1px solid',
      borderColor: 'inherit',
      bgGradient: 'to-r',
      gradientFrom: 'blackAlpha.300',
      gradientTo: 'transparent',
    },
  },
})

const pinnedRightStyles = defineStyle({
  position: 'sticky',
  right: 'var(--pinned-right)',
  zIndex: 1,
  bg: 'var(--data-grid-bg)',
  opacity: 0.95,
  '&[data-first]:after': {
    content: '""',
    position: 'absolute',
    left: '-4px',
    zIndex: 1,
    top: '-1px',
    bottom: '-1px',
    width: '4px',
    pointerEvents: 'none',
    bgGradient: 'to-l',
    gradientFrom: 'blackAlpha.200',
    gradientTo: 'transparent',
  },
  _before: {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
    pointerEvents: 'none',
  },
  _dark: {
    '&[data-first]:after': {
      my: '1px',
      borderRight: '1px solid',
      borderColor: 'inherit',
      bgGradient: 'to-l',
      gradientFrom: 'blackAlpha.300',
      gradientTo: 'transparent',
    },
  },
})

export const dataGridSlotRecipe = defineSlotRecipe({
  slots: [
    'root',
    'scrollArea',
    'table',
    'header',
    'body',
    'footer',
    'row',
    'columnHeader',
    'columnTitle',
    'resizer',
    'cell',
    'caption',
  ],
  base: {
    root: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: '100%',
      maxWidth: '100%',
      position: 'relative',
      textStyle: 'sm',
      '--data-grid-bg': 'colors.bg',
      '--data-grid-row-bg': 'colors.bg',
      '--data-grid-row-hover-bg': 'inherit',
      '--data-grid-row-selected-bg': 'inherit',
    },
    scrollArea: {
      height: '100%',
      width: '100%',
      overflow: 'auto',
    },
    table: {
      display: 'grid',
      fontVariantNumeric: 'lining-nums tabular-nums',
      borderCollapse: 'collapse',
    },
    header: {
      display: 'grid',
      '&[data-sticky]': {
        position: 'sticky',
        top: 0,
        zIndex: 2,
        bg: 'var(--data-grid-bg)',
      },
    },
    body: {
      display: 'grid',
      position: 'relative',
    },
    columnHeader: {
      display: 'flex',
      position: 'relative',
      alignItems: 'center',
      fontWeight: 'medium',
      textAlign: 'start',
      padding: 0,
      '&[data-pinned=left]': pinnedLeftStyles,
      '&[data-pinned=right]': pinnedRightStyles,
    },
    columnTitle: {
      display: 'flex',
      flex: 1,
      '&[aria-sort="none"] svg': {
        opacity: 0,
        transitionProperty: 'opacity',
        transitionDuration: 'normal',
      },
      '&[aria-sort="none"]:hover svg, &[aria-sort="none"]:focus-visible svg': {
        opacity: 1,
      },
      '[data-is-numeric=true] &': {
        textAlign: 'end',
        justifyContent: 'end',
      },
      _focusVisible: {
        outlineColor: 'colorPalette.400',
        outlineOffset: '-2px',
      },
    },
    resizer: {
      position: 'absolute',
      right: '-8px',
      zIndex: 1,
      visibility: 'hidden',
      width: '20px',
      height: '100%',
      userSelect: 'none',
      cursor: 'col-resize',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'fg.muted/50',
      '&:hover, &:active': {
        color: 'colorPalette.solid',
        visibility: 'visible',
      },
      _dark: {
        '&:hover, &:active': {
          color: 'colorPalette.solid',
        },
      },
      _before: {
        content: '""',
        display: 'block',
        width: '2px',
        height: '18px',
        cursor: 'col-resize',
        bg: 'currentColor',
        transitionProperty: 'all',
        transitionDuration: 'normal',
      },
      'th:hover &': {
        visibility: 'visible',
      },
    },
    row: {
      '--focus-shadow-color': 'colors.colorPalette.solid',
      bg: 'var(--data-grid-row-bg)',
      display: 'flex',
      width: 'full',
      position: 'relative',
      _hover: {
        bg: 'var(--data-grid-row-hover-bg)',
      },
      _selected: {
        bg: 'var(--data-grid-row-selected-bg)',
      },
      _focusVisible: {
        outline: 'none',
        _after: {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          bg: 'transparent',
          zIndex: 1,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 2px var(--focus-shadow-color)',
        },
      },
    },
    cell: {
      display: 'flex',
      alignItems: 'center',
      textAlign: 'start',
      _focus: {
        outline: 'none',
        boxShadow: 'inset 0 0 0 2px var(--focus-shadow-color)',
      },
      '&[data-pinned=left]': pinnedLeftStyles,
      '&[data-pinned=right]': pinnedRightStyles,
      '&[data-is-numeric=true]': {
        textAlign: 'end',
        justifyContent: 'end',
      },
    },
    caption: {
      mt: 4,
      fontFamily: 'heading',
      textAlign: 'center',
      fontWeight: 'medium',
    },
  },
  variants: {
    variant: {
      simple: {
        columnHeader: {
          color: 'fg.subtle',
          borderBottomWidth: '1px',
          borderColor: 'border.subtle',
        },
        caption: {
          color: 'fg.muted',
        },
        cell: {
          borderBottomWidth: '1px',
          borderColor: 'border.muted',
          '&[data-range-selected]': {
            bg: 'colorPalette.muted',
            _dark: {
              bg: 'colorPalette.solid/10',
            },
          },
        },
        body: {
          '& tr[data-interactive]:hover': {
            '& [data-focused]:before': {
              boxShadow:
                'inset 0 0 0 2px var(--chakra-colors-colorPalette-400)',
            },
            '& [data-pinned]:before': {
              bg: 'var(--data-grid-row-hover-bg)',
            },
            '--data-grid-row-hover-bg': 'colors.gray.50',
            _dark: {
              '--data-grid-row-hover-bg': 'colors.whiteAlpha.50',
            },
          },
          '& tr[data-selected]': {
            '& [data-pinned]:before': {
              bg: 'var(--data-grid-row-selected-bg)',
            },
            '--data-grid-row-selected-bg': 'colors.gray.50',
            borderColor: 'gray.100',
            _dark: {
              '--data-grid-row-selected-bg': 'colorPalette.500/10',
              borderColor: 'colorPalette.500/20',
            },
            '&[data-interactive]:hover': {
              '& [data-pinned]:before': {
                bg: 'var(--data-grid-row-selected-bg)',
              },
              '--data-grid-row-selected-bg': 'colors.gray.100',
              _dark: {
                '--data-grid-row-selected-bg': 'colorPalette.500/20',
              },
            },
          },
          '& tr:last-of-type': {
            border: 0,
          },
        },
        footer: {
          tr: {
            '&:last-of-type': {
              th: { borderBottomWidth: 0 },
            },
          },
        },
      },
    },
    striped: {
      true: {
        body: {
          'tr:nth-of-type(odd)': {
            '--data-grid-row-bg': 'colors.gray.50',
            _dark: {
              '& [data-pinned]': {
                bg: 'var(--data-grid-bg)',
              },
              '& [data-pinned]:before': {
                bg: 'var(--data-grid-row-bg)',
              },
              '--data-grid-row-bg': 'colors.whiteAlpha.50',
              _selected: {
                '& [data-pinned]:before': {
                  bg: 'var(--data-grid-row-selected-bg)',
                },
              },
            },
          },
        },
      },
    },
    size: {
      sm: {
        columnTitle: {
          px: '3',
          py: '2',
        },
        cell: {
          px: '3',
          py: '2',
        },
        caption: {
          px: '3',
          py: '2',
        },
      },
      md: {
        columnTitle: {
          px: '4',
          py: '3',
        },
        cell: {
          px: '4',
          py: '3',
        },
        caption: {
          px: '4',
          py: '2',
        },
      },
      lg: {
        columnTitle: {
          px: '6',
          py: '4',
        },
        cell: {
          px: '6',
          py: '4',
        },
        caption: {
          px: '6',
          py: '2',
        },
      },
      xl: {
        columnTitle: {
          px: '8',
          py: '5',
        },
        cell: {
          px: '8',
          py: '5',
        },
        caption: {
          px: '6',
          py: '2',
        },
      },
    },
  },
  defaultVariants: {
    variant: 'simple',
    size: 'md',
  },
})

export type DataGridVariantProps = RecipeVariantProps<typeof dataGridSlotRecipe>
