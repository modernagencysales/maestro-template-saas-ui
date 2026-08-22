import * as React from 'react'

import { useDisclosure } from '@chakra-ui/react'
import { type UseFloatingOptions, useFloating } from '@floating-ui/react'

import { useTourContext } from './use-tour'

export interface UseTourBeaconProps extends UseFloatingOptions {
  /**
   * Callback to run when the tooltip shows
   */
  onOpen?(): void
  /**
   * Callback to run when the tooltip hides
   */
  onClose?(): void
  /**
   * Custom `id` to use in place of `uuid`
   */
  id?: string
  /**
   * If `true`, the tooltip will be shown (in controlled mode)
   */
  open?: boolean
  /**
   * If `true`, the tooltip will be initially shown
   */
  defaultOpen?: boolean
  /**
   * If `true`, the beacon will be disabled
   */
  disabled?: boolean
}

export function useTourBeacon(props: UseTourBeaconProps = {}) {
  const {
    onOpen: onOpenProp,
    onClose: onCloseProp,
    placement = 'right-start',
    id,
    open: openProp,
    defaultOpen,
    disabled,
    ...htmlProps
  } = props

  const { open, onOpen, onClose } = useDisclosure({
    open: openProp,
    defaultOpen,
    onOpen: onOpenProp,
    onClose: onCloseProp,
  })

  const { refs, floatingStyles } = useFloating({
    placement,
  })

  const { start } = useTourContext()

  const tooltipId = id ?? React.useId()

  const context = useTourContext()

  React.useEffect(() => {
    const step = context.step ?? context.steps[0]
    console.log(step)
    const target = step?.target?.()
    console.log(target)
    if (!target) {
      return
    }

    if (typeof refs.setReference === 'function') {
      refs.setReference(target)
    }
  }, [context.step, context.steps, refs])

  // React.useEffect(() => {
  //   targetElement && !isActive && !isCompleted ? onOpen() : onClose()
  // }, [targetElement, isActive])

  const onClick = React.useCallback(() => {
    if (disabled) {
      return
    }

    start()
  }, [start, disabled])

  const getTourBeaconPositionerProps = React.useCallback(
    (props = {}) => ({
      ...props,
      style: floatingStyles,
    }),
    [floatingStyles],
  )

  const getTourBeaconProps = React.useCallback(
    (props: any = {}, ref: React.Ref<any> = null) => {
      const tooltipProps = {
        ref,
        ...htmlProps,
        ...props,
        id: tooltipId,
        role: 'tooltip',
        onClick,
        style: {
          ...props.style,
          position: 'relative',
          // transformOrigin: popperCSSVars.transformOrigin.varRef,
        },
      }

      return tooltipProps
    },
    [htmlProps, tooltipId, onClick],
  )

  return {
    open,
    getTourBeaconProps,
    getTourBeaconPositionerProps,
  }
}

export type UseTourBeaconReturn = ReturnType<typeof useTourBeacon>
