import { useRef } from 'react'

import { FocusChangeHandler } from '@saas-ui-pro/react'
import { useHotkeys } from '@saas-ui/use-hotkeys'

export const useDataGridFocus = <Data extends object = object>() => {
  const focusedRef = useRef(false)

  const containerRef = useRef<HTMLTableElement | null>(null)

  const onFocusChange: FocusChangeHandler<Data> = () => {
    focusedRef.current = true
  }

  useHotkeys(['ArrowUp', 'ArrowDown'], () => {
    if (!focusedRef.current) {
      containerRef.current
        ?.querySelector<HTMLTableRowElement>('tbody tr:first-child')
        ?.focus()
      focusedRef.current = true
    }
  })

  return {
    onFocusChange,
    containerRef,
  }
}
