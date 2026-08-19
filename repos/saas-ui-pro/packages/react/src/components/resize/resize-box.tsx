'use client'

import * as React from 'react'

import { HTMLChakraProps, chakra } from '@chakra-ui/react'

import { cx } from '../../utils/dom'
import { ResizeHandle } from './resize-handle'
import { UseResizeProps, useResize } from './use-resize'

export interface ResizeBoxProps
  extends Omit<HTMLChakraProps<'div'>, 'onResize'>,
    Omit<UseResizeProps, 'position'> {}

export const ResizeBox: React.FC<ResizeBoxProps> = (props) => {
  const {
    handlePosition,
    onResize,
    defaultWidth,
    enabled = true,
    children,
    ...rest
  } = props

  const { getContainerProps, getHandleProps } = useResize({
    handlePosition,
    onResize,
    defaultWidth,
    enabled,
  })

  return (
    <chakra.div
      {...rest}
      {...getContainerProps()}
      className={cx('sui-resize-box', props.className)}
      css={[{ position: 'relative' }, rest.css]}
    >
      {children}

      {enabled && <ResizeHandle {...getHandleProps()} />}
    </chakra.div>
  )
}

ResizeBox.displayName = 'ResizeBox'
