import { functionalUpdate, makeStateUpdater } from '@tanstack/react-table'
import type { TableFeature, Updater } from '@tanstack/react-table'

import { CellSelectionModel } from './cell-selection-model'

type CellSelectionState = {
  selectedCells: Array<readonly [number, number]>
}

export interface CellSelectionTableState {
  cellSelection: CellSelectionState
}

export interface CellSelectionTableOptions {
  experimental_enableCellSelection: boolean
  onCellSelectionChange: (updater: Updater<CellSelectionState>) => void
}

export interface CellSelectionTableInstance {
  setCellSelection: (updater: Updater<CellSelectionState>) => void
  getCellSelectionModel: () => CellSelectionModel | null
  setSelectedCells: (updater: Updater<CellSelectionState>) => void
  setRootNode: (node: HTMLElement) => void
  onUnmount: () => void
}

export interface CellSelectionCell {
  getIsInSelectionRange: () => boolean
}

export const CellSelectionFeature: TableFeature<any> = {
  getInitialState: (state): CellSelectionTableState => ({
    cellSelection: {
      selectedCells: [],
    },
    ...state,
  }),
  getDefaultOptions: (table): CellSelectionTableOptions => ({
    experimental_enableCellSelection: false,
    onCellSelectionChange: makeStateUpdater('cellSelection', table),
  }),
  createTable: (table): void => {
    let selectionModel: CellSelectionModel | null = null

    table.setRootNode = (node: HTMLElement) => {
      if (!selectionModel && table.options.experimental_enableCellSelection) {
        selectionModel = new CellSelectionModel(node, {
          onSelectionChange: (selectedCells) => {
            table.setSelectedCells(() => ({ selectedCells }))
          },
        })
      }
    }

    table.getCellSelectionModel = () => {
      return selectionModel
    }

    table.setSelectedCells = (updater) => {
      return table.options.onCellSelectionChange?.((old) => {
        return functionalUpdate(updater, old)
      })
    }

    table.onUnmount = () => {
      selectionModel?.destroy()
      selectionModel = null
    }
  },
  createCell: (cell, column, row, table): void => {
    cell.getIsInSelectionRange = () => {
      return (
        table
          .getCellSelectionModel()
          ?.isInRange([row.index, column.getIndex()]) ?? false
      )
    }
  },
}
