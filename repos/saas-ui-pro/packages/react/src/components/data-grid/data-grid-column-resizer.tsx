import { useEnvironmentContext } from '@ark-ui/react/environment'
import { chakra, useTableStyles } from '@chakra-ui/react'
import type { Header } from '@tanstack/react-table'

import { useDataGridStyles } from './data-grid-context.tsx'

export interface DataGridColumnResizerProps<Data extends object, TValue> {
  header: Header<Data, TValue>
}
export const DataGridColumnResizer = <Data extends object, TValue>(
  props: DataGridColumnResizerProps<Data, TValue>,
) => {
  const { header, ...rest } = props

  const styles = useDataGridStyles()

  if (!header.column.getCanResize()) {
    return null
  }

  const env = useEnvironmentContext()

  const document = env.getDocument()

  return (
    <chakra.div
      {...rest}
      css={[styles.resizer]}
      className="sui-data-grid__resizer"
      onDoubleClick={() => header.column.resetSize()}
      onMouseDown={header.getResizeHandler(document)}
      onTouchStart={header.getResizeHandler(document)}
    />
  )
}

DataGridColumnResizer.displayName = 'DataGridColumnResizer'
