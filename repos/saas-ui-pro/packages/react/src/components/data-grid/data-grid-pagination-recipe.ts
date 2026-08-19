import { defineSlotRecipe } from '@chakra-ui/react/styled-system'

export const dataGridPaginationRecipe = defineSlotRecipe({
  slots: ['root'],
  base: {
    root: {
      display: 'flex',
      flexDirection: 'row',
      gap: 1,
    },
  },
  variants: {
    size: {
      xs: {
        root: {
          textStyle: 'xs',
          px: 2,
          py: 1,
        },
      },
      sm: {
        root: {
          textStyle: 'sm',
          px: 4,
          py: 2,
        },
      },
    },
  },
  defaultVariants: {
    size: 'sm',
  },
})
