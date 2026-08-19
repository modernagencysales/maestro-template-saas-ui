export interface DataGridTranslations {
  /**
   * @default 'Page'
   */
  page: string
  /**
   * @default 'of {pageCount}'
   */
  of: string
  /**
   * @default 'Next page'
   */
  nextPage: string
  /**
   * @default 'Previous page'
   */
  previousPage: string
  /**
   * @default 'Expand all rows'
   */
  expandRows: string
  /**
   * @default 'Collapse all rows'
   */
  collapseRows: string
  /**
   * @default 'Deselect all rows'
   */
  deselectAllRows: string
  /**
   * @default 'Select all rows'
   */
  selectAllRows: string
  /**
   * @default 'Select row'
   */
  selectRow: string
  /**
   * @default 'Deselect row'
   */
  deselectRow: string
  /**
   * @default 'Sort ascending'
   */
  sortAscending: string
  /**
   * @default 'Sort descending'
   */
  sortDescending: string
}

export const defaultTranslations: DataGridTranslations = {
  page: 'Page',
  of: 'of {pageCount}',
  nextPage: 'Next page',
  previousPage: 'Previous page',
  expandRows: 'Expand all rows',
  collapseRows: 'Collapse all rows',
  deselectAllRows: 'Deselect all rows',
  selectAllRows: 'Select all rows',
  selectRow: 'Select row',
  deselectRow: 'Deselect row',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
}
