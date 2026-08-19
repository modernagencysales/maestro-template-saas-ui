import { type RecipeVariantProps, defineSlotRecipe } from '@chakra-ui/react'

export const activeFilterSlotRecipe = defineSlotRecipe({
  className: 'sui-active-filter',
  slots: ['root', 'label', 'operator', 'value', 'valueButton', 'remove'],
  base: {
    root: {
      borderWidth: '1px',
      borderRadius: 'md',
      display: 'flex',
      fontSize: 'sm',
      gap: '1',
      overflow: 'clip',
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      px: 2,
      height: '100%',
    },
    operator: {
      color: 'muted',
      px: 2,
      minWidth: 0,
    },
    value: {
      display: 'flex',
      alignItems: 'center',
      px: 2,
    },
    valueButton: {
      fontWeight: 'normal',
      px: '2',
      borderRadius: 0,
      fontSize: 'sm',
    },
    remove: {},
  },
  variants: {
    variant: {
      plain: {},
      surface: {
        root: {
          bg: 'bg.subtle',
        },
        label: {
          bg: 'bg.panel',
        },
        operator: {
          bg: 'bg.panel',
        },
        value: {
          bg: 'bg.panel',
        },
        valueButton: {
          bg: 'bg.panel',
        },
        remove: {
          bg: 'bg.panel',
        },
      },
    },
    size: {
      xs: {
        root: {
          textStyle: 'xs',
          gap: '1px',
        },
      },
      sm: {},
      md: {},
      lg: {},
      xl: {},
    },
  },
  defaultVariants: {
    variant: 'plain',
    size: 'md',
  },
})

export type ActiveFilterVariantProps = RecipeVariantProps<
  typeof activeFilterSlotRecipe
>
