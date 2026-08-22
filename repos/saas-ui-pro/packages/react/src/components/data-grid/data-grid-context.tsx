import React from 'react'

import {
  type HTMLChakraProps,
  type SlotRecipeProps,
  createSlotRecipeContext,
} from '@chakra-ui/react'
import type { Table as TableInstance, TableState } from '@tanstack/react-table'

import {
  type DataGridTranslations,
  defaultTranslations,
} from './data-grid-translations'
import type { DataGridVariantProps } from './data-grid.recipe.ts'
import type { DataGridSlotProps } from './data-grid.types'

const {
  useStyles: useDataGridStyles,
  withProvider,
  withContext,
  withRootProvider,
} = createSlotRecipeContext({
  key: 'suiDataGrid',
})

export { useDataGridStyles, withProvider, withContext }

export interface DataGridContextValue<Data extends object>
  extends SlotRecipeProps<'suiDataGrid'>,
    DataGridVariantProps,
    Pick<HTMLChakraProps<'div'>, 'colorPalette'> {
  instance: TableInstance<Data>
  slotProps?: DataGridSlotProps<Data>
  icons?: DataGridIcons
  translations: DataGridTranslations
  state: TableState
}

export const DataGridContext =
  React.createContext<DataGridContextValue<any> | null>(null)

export interface DataGridProviderProps<Data extends object>
  extends SlotRecipeProps<'suiDataGrid'>,
    Pick<HTMLChakraProps<'div'>, 'colorPalette'>,
    DataGridVariantProps {
  instance: TableInstance<Data>
  slotProps?: DataGridSlotProps<Data>
  icons?: DataGridIcons
  translations?: Partial<DataGridTranslations>
  children: React.ReactNode
}

export const DataGridProvider = withRootProvider(
  <Data extends object>(props: DataGridProviderProps<Data>) => {
    const {
      instance,
      children,
      colorPalette,
      variant,
      size,
      icons,
      translations,
    } = props

    const state = instance.getState()

    const context: DataGridContextValue<Data> = React.useMemo(
      () => ({
        instance,
        state,
        colorPalette,
        variant,
        size,
        icons,
        translations: {
          ...defaultTranslations,
          ...translations,
        },
      }),
      [instance, state, colorPalette, variant, size, icons, translations],
    )

    return (
      <DataGridContext.Provider value={context}>
        {children}
      </DataGridContext.Provider>
    )
  },
) as <Data extends object>(
  props: DataGridProviderProps<Data>,
) => React.ReactElement

export interface DataGridIcons {
  sort?: React.ReactElement
  sortAscending?: React.ReactElement
  sortDescending?: React.ReactElement
  rowExpanded?: React.ReactElement
  rowCollapsed?: React.ReactElement
  nextPage?: React.ReactElement
  previousPage?: React.ReactElement
}

export const useDataGridContext = <Data extends object>() => {
  return React.useContext(DataGridContext) as DataGridContextValue<Data>
}

export const useDataGridIcons = () => {
  const { icons } = useDataGridContext()

  return icons
}

export const useDataGridTranslations = () => {
  const { translations } = useDataGridContext()

  return translations
}
