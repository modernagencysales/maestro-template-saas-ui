export interface FocusState {
  row: number
  column: number
}

export type FocusMode = 'grid' | 'list'

export interface FocusModelOptions {
  mode?: FocusMode
  debug?: boolean
  onFocusChange?: (focus: FocusState) => void
  getSelectedRows?: () => any[]
  onToggleRowSelected?: (row: number) => void
  onSelectRows?: (start: number, end?: number) => void
  onExpandRow?: (row: number) => void
  onCollapseRow?: (row: number) => void
}

const ROW_SELECTORS = 'tr, [role="row"]'
const BODY_ROW_SELECTORS = 'tbody tr, tbody [role="row"]'
const SELECTED_ROW_SELECTORS =
  'tr[aria-selected="true"], [role="row"][aria-selected="true"]'
const CELL_SELECTORS = 'td, [role="gridcell"]'
const FOCUSABLE_SELECTORS = 'a, button, input, textarea, select, [tabindex]'

const SPACEBAR = ' '

const closest = (target: HTMLElement | EventTarget, selector: string) => {
  const el = target as HTMLElement
  if (el.matches(selector)) {
    return el
  }
  return el.closest(selector)
}

const matches = (target: HTMLElement | EventTarget, selector: string) => {
  return (target as HTMLElement).matches(selector)
}

export class FocusModel {
  #focusedRow = 0
  #focusedCol = 0

  #focusedElement: HTMLElement | null = null

  #highlightedRow: number | null = null
  #highlightedCol: number | null = null

  #initialSelectedRow: number | null = null

  enabled = true

  constructor(
    public gridEl: HTMLElement | null,
    private options: FocusModelOptions,
  ) {
    this.init()
  }

  init() {
    this.#debug('init', this.gridEl, this.options)

    this.gridEl?.addEventListener('mousedown', this.handleMouseDown)
    this.gridEl?.addEventListener('keydown', this.handleKeyDown)
    this.gridEl?.addEventListener('mouseover', this.handleMouseOver)
  }

  #debug = (...args: any[]) => {
    if (this.options.debug === true) {
      console.debug('[FocusModel]', ...args)
    }
  }

  handleMouseDown = (e: MouseEvent) => {
    const target = e.target as EventTarget

    const mode = this.options.mode

    const row = closest(target, ROW_SELECTORS) as HTMLTableRowElement

    if (!row || row.dataset.row === undefined) {
      return
    }

    const rowIndex = Number.parseInt(row.dataset.row)

    if (mode === 'list') {
      if (!matches(target, FOCUSABLE_SELECTORS)) {
        row.focus()
      }

      this.setFocusedRow(rowIndex)
    } else if (mode === 'grid') {
      const cell = closest(target, CELL_SELECTORS) as HTMLTableCellElement

      if (!cell || cell.dataset.col === undefined) {
        return
      }

      const colIndex = Number.parseInt(cell.dataset.col)

      this.setFocusedCol(rowIndex, colIndex)
    }
  }

  handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    let focusedRow = this.#focusedRow
    let focusedCol = this.#focusedCol

    const mode = this.options.mode

    const row = closest(target, ROW_SELECTORS) as HTMLTableRowElement
    const currentRowFocused = row && row.dataset.row === focusedRow.toString()

    const keyMap: Record<KeyboardEvent['key'], () => void> = {
      ArrowDown: () => {
        if (!currentRowFocused) {
          return
        }

        const index = focusedRow + 1

        if (!this.isValidRow(index)) {
          return
        }

        // prevent scroll
        e.preventDefault()

        if (e.shiftKey) {
          if (!this.#initialSelectedRow) {
            this.#initialSelectedRow = focusedRow
          }

          if (!this.hasSelectedRows()) {
            this.selectRows(focusedRow)
            return
          }

          const isBefore = index < this.#initialSelectedRow!

          isBefore
            ? this.selectRows(index, this.#initialSelectedRow!)
            : this.selectRows(this.#initialSelectedRow!, index)
        } else {
          this.#initialSelectedRow = null
        }

        focusedRow = index
      },
      ArrowUp: () => {
        if (!currentRowFocused) {
          return
        }

        const index = focusedRow - 1

        if (!this.isValidRow(index)) {
          return
        }

        // prevent scroll
        e.preventDefault()

        if (e.shiftKey) {
          if (!this.#initialSelectedRow) {
            this.#initialSelectedRow = focusedRow
          }

          if (!this.hasSelectedRows()) {
            this.selectRows(focusedRow)
            return
          }

          const isAfter = index > this.#initialSelectedRow!

          isAfter
            ? this.selectRows(this.#initialSelectedRow!, index)
            : this.selectRows(index, this.#initialSelectedRow!)
        } else {
          this.#initialSelectedRow = null
        }

        focusedRow = index
      },
      Tab: () => {
        if (!currentRowFocused) {
          return
        }

        if (e.shiftKey) {
          if (mode === 'grid' && this.isValidCell(focusedRow, focusedCol - 1)) {
            focusedCol -= 1
          } else if (this.isValidRow(focusedRow - 1)) {
            focusedRow -= 1
          }
        } else {
          if (mode === 'grid' && this.isValidCell(focusedRow, focusedCol + 1)) {
            focusedCol += 1
          } else if (this.isValidRow(focusedRow + 1)) {
            focusedRow += 1
          }
        }
      },
      ArrowRight: () => {
        if (mode === 'grid' && this.isValidCell(focusedRow, focusedCol + 1)) {
          e.preventDefault()

          focusedCol += 1
        } else if (mode === 'list') {
          this.options.onExpandRow?.(focusedRow)
        }
      },
      ArrowLeft: () => {
        if (mode === 'grid' && this.isValidCell(focusedRow, focusedCol - 1)) {
          e.preventDefault()

          focusedCol -= 1
        } else if (mode === 'list') {
          this.options.onCollapseRow?.(focusedRow)
        }
      },
      Home: () => {
        if (mode === 'grid') {
          focusedCol = 0
        }

        if (e.ctrlKey || mode === 'list') {
          focusedRow = 0
        }
      },
      End: () => {
        if (!this.gridEl) {
          return
        }

        const rows =
          this.gridEl.querySelectorAll<HTMLTableRowElement>(BODY_ROW_SELECTORS)

        const lastRowIndex = rows.length - 1

        if (mode === 'grid') {
          focusedCol =
            rows[lastRowIndex].querySelectorAll<HTMLTableCellElement>(
              CELL_SELECTORS,
            )?.length - 1 || 0
        }

        if (e.ctrlKey || mode === 'list') {
          focusedRow = lastRowIndex
        }
      },
      // space
      [SPACEBAR]: () => {
        const row =
          e.target && (closest(e.target, ROW_SELECTORS) as HTMLTableRowElement)
        const isFocusedRow = row && row.dataset.row === focusedRow.toString()

        if (isFocusedRow && this.options.onToggleRowSelected) {
          this.options.onToggleRowSelected?.(focusedRow)
          e.preventDefault()
        }
      },
      Enter: () => {
        if (!currentRowFocused) {
          return
        }
        const el = target.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
        if (el) {
          this.enabled = false

          el.focus()
        }
      },
    }

    if (this.enabled) {
      keyMap[e.key]?.()
    } else if (e.key === 'Escape') {
      this.enabled = true

      switch (mode) {
        case 'grid':
          this.setFocusedCol(focusedRow, focusedCol)
          break
        case 'list':
          this.setFocusedRow(focusedRow)
          break
      }
    }

    if (focusedRow === this.#focusedRow && focusedCol === this.#focusedCol) {
      return
    }

    mode === 'grid'
      ? this.setFocusedCol(focusedRow, focusedCol)
      : this.setFocusedRow(focusedRow)

    e.preventDefault() // prevent scrolling
  }

  handleMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    const row = closest(target, ROW_SELECTORS) as HTMLTableRowElement

    if (!row || row.dataset.row === undefined) {
      return
    }

    const rowIndex = Number.parseInt(row.dataset.row)

    this.#highlightedRow = rowIndex

    if (this.options.mode === 'grid') {
      const cell = closest(target, CELL_SELECTORS) as HTMLTableCellElement

      if (!cell || cell.dataset.col === undefined) {
        return
      }

      const colIndex = Number.parseInt(cell.dataset.col)

      if (colIndex === this.#highlightedCol) {
        return
      }

      this.#highlightedCol = colIndex
    }
  }

  setFocusedRow = (row: number) => {
    const el = this.gridEl?.querySelector<HTMLTableRowElement>(
      `[data-row="${row}"]`,
    )

    el?.setAttribute('data-focused', '')
    el?.setAttribute('tabindex', '0')
    el?.focus()

    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    if (this.#focusedElement && this.#focusedElement !== el) {
      this.#focusedElement.removeAttribute('data-focused')
      this.#focusedElement.setAttribute('tabindex', '-1')
    }

    this.#focusedElement = el

    this.#focusedRow = row

    this.options.onFocusChange?.({ row, column: 0 })
  }

  setFocusedCol = (row: number, col: number) => {
    const cell = this.gridEl?.querySelector<HTMLTableCellElement>(
      `[data-row="${row}"] > [data-col="${col}"]`,
    )

    cell?.setAttribute('data-focused', '')
    cell?.setAttribute('tabindex', '0')
    cell?.focus()

    if (this.#focusedElement && this.#focusedElement !== cell) {
      this.#focusedElement.removeAttribute('data-focused')
      this.#focusedElement.setAttribute('tabindex', '-1')
    }

    this.#focusedElement = cell

    // make sure we enable keyboard events
    this.enabled = true

    this.#focusedRow = row
    this.#focusedCol = col

    this.options.onFocusChange?.({ row, column: col })
  }

  isValidRow(row: number) {
    return !!this.gridEl?.querySelector<HTMLTableRowElement>(
      `[data-row="${row}"]`,
    )
  }

  isValidCell(row: number, col: number) {
    return !!this.gridEl?.querySelector<HTMLTableCellElement>(
      `[data-row="${row}"] > [data-col="${col}"]`,
    )
  }

  hasSelectedRows() {
    return this.options.getSelectedRows
      ? this.options.getSelectedRows().length
      : this.gridEl?.querySelector(SELECTED_ROW_SELECTORS) !== null
  }

  selectRows(start: number, end?: number) {
    this.options.onSelectRows?.(start, end)
  }

  get focusedRow() {
    return this.#focusedRow
  }

  get focusedCol() {
    return this.#focusedCol
  }

  reset() {
    this.#focusedElement?.removeAttribute('data-focused')
    this.#focusedElement?.setAttribute('tabindex', '-1')

    this.#focusedElement = null
    this.#focusedRow = 0
    this.#focusedCol = 0

    this.#highlightedRow = null
    this.#highlightedCol = null
  }

  destroy() {
    this.gridEl?.removeEventListener('mousedown', this.handleMouseDown)
    this.gridEl?.removeEventListener('mouseover', this.handleMouseOver)
    this.gridEl?.removeEventListener('keydown', this.handleKeyDown)
  }
}
