import type {
  CellSelectionCell,
  CellSelectionTableInstance,
  CellSelectionTableOptions,
  CellSelectionTableState,
} from './cell-selection/cell-selection-feature'
import { DataGridColumnMeta } from './data-grid.types'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue>
    extends DataGridColumnMeta<TData, TValue> {}

  interface TableState extends CellSelectionTableState {}

  interface TableOptionsResolved<TData extends RowData>
    extends Partial<CellSelectionTableOptions> {}

  interface Table<TData extends RowData> extends CellSelectionTableInstance {}

  interface Cell<TData extends RowData, TValue> extends CellSelectionCell {}
}
