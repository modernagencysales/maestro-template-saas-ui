import { closest } from '../focus-model/utils'

export interface CellSelectionModelOptions {
  onSelectionChange?: (selectedCells: Array<readonly [number, number]>) => void
}

export class CellSelectionModel {
  #startCell: null | readonly [number, number] = null

  #selectedCells: Array<readonly [number, number]> = []

  #isMouseDown = false

  constructor(
    public rootEl: HTMLElement,
    private options: CellSelectionModelOptions,
  ) {
    this.init()
  }

  init() {
    this.rootEl.addEventListener('mousedown', this.handleMouseDown)
    this.rootEl.addEventListener('mouseup', this.handleMouseUp)
    this.rootEl.addEventListener('mouseover', this.handleMouseOver)
  }

  handleMouseDown = (e: MouseEvent) => {
    const cell = this.getCellFromEvent(e)

    if (!cell) {
      return
    }

    if (e.button === 2 && this.isInRange(cell)) {
      return
    }

    if (!e.ctrlKey && !e.shiftKey) {
      this.#selectedCells = []
      if (!this.#isMouseDown) {
        this.#startCell = cell
      }
    }

    if (e.ctrlKey) {
      this.#selectedCells = this.#selectedCells.filter(
        (c) => c[0] !== cell[0] && c[1] !== cell[1],
      )
      if (!this.#isMouseDown) {
        this.#startCell = cell
      }
    }

    if (e.shiftKey && this.#startCell) {
      this.#selectedCells = this.getCellsBetween(this.#startCell, cell)
    }

    this.updateSelection()

    this.#isMouseDown = true
  }

  handleMouseOver = (e: MouseEvent) => {
    if (e.buttons !== 1 || !this.#isMouseDown || !this.#startCell) {
      return
    }

    const currentCell = this.getCellFromEvent(e)

    if (currentCell) {
      this.#selectedCells = this.getCellsBetween(this.#startCell, currentCell)
      this.updateSelection()
    }
  }

  handleMouseUp = () => {
    this.#isMouseDown = false
  }

  getCellFromEvent = (e: MouseEvent) => {
    if (!e.target) {
      return
    }

    const td = closest<HTMLTableCellElement>(e.target, 'td')

    if (!td) {
      return
    }

    const tr = closest<HTMLTableRowElement>(td, 'tr')

    if (!tr) {
      return
    }

    const col = Number.parseInt(td.dataset.col!)
    const row = Number.parseInt(tr.dataset.row!)

    return [row, col] as const
  }

  getCellsBetween = (
    cell1: readonly [number, number],
    cell2: readonly [number, number],
  ) => {
    const [startRow, endRow] = [
      Math.min(cell1[0], cell2[0]),
      Math.max(cell1[0], cell2[0]),
    ]
    const [startCol, endCol] = [
      Math.min(cell1[1], cell2[1]),
      Math.max(cell1[1], cell2[1]),
    ]

    const cells: Array<[number, number]> = []
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        cells.push([row, col])
      }
    }
    return cells
  }

  isInRange = (cell: readonly [number, number]) => {
    return this.#selectedCells.some((c) => c[0] === cell[0] && c[1] === cell[1])
  }

  updateSelection() {
    // Remove previous selection
    this.rootEl.querySelectorAll('[data-range-selected]').forEach((el) => {
      el.removeAttribute('data-range-selected')
    })

    // Apply new selection
    this.#selectedCells.forEach(([row, col]) => {
      const cell = this.rootEl.querySelector(
        `tr[data-row="${row}"] td[data-col="${col}"]`,
      )
      if (cell) {
        cell.setAttribute('data-range-selected', '')
      }
    })

    this.options.onSelectionChange?.(this.#selectedCells)
  }

  destroy() {
    this.rootEl.removeEventListener('mousedown', this.handleMouseDown)
    this.rootEl.removeEventListener('mouseup', this.handleMouseUp)
    this.rootEl.removeEventListener('mouseover', this.handleMouseOver)
  }
}
