import { createSystem, defineConfig, mergeConfigs } from '@chakra-ui/react'
import { defaultConfig as baseConfig } from '@saas-ui/chakra-preset'

import { asideSlotRecipe } from './components/aside/aside.recipe.ts'
import { dataGridPaginationRecipe } from './components/data-grid/data-grid-pagination-recipe.ts'
import { dataGridSlotRecipe } from './components/data-grid/data-grid.recipe.ts'
import { splitPageSlotRecipe } from './components/split-page/split-page.recipe.ts'

export const proConfig = defineConfig({
  theme: {
    slotRecipes: {
      suiDataGrid: dataGridSlotRecipe,
      suiDataGridPagination: dataGridPaginationRecipe,
      suiAside: asideSlotRecipe,
      suiSplitPage: splitPageSlotRecipe,
    },
  },
})

export const defaultConfig = mergeConfigs(baseConfig, proConfig)

export const system = createSystem(defaultConfig)
