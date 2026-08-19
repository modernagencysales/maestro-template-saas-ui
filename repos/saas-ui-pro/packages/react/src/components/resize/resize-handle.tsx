'use client'

import * as React from 'react'

import { HTMLChakraProps, chakra } from '@chakra-ui/react'

import { cx } from '../../utils/dom'
import { useResizeContext } from './use-resize'

export const ResizeHandle: React.FC<HTMLChakraProps<'div'>> = (props) => {
  const styles = {
    position: 'absolute',
    userSelect: 'none',
    width: '10px',
    height: '100%',
    top: '0px',
    cursor: 'col-resize',
  }

  const context = useResizeContext()

  if (context?.enabled === false) {
    return null
  }

  return (
    <chakra.div
      {...props}
      {...context?.getHandleProps()}
      css={styles}
      className={cx('sui-resize-handle', props.className)}
    />
  )
}

ResizeHandle.displayName = 'ResizeHandle'
