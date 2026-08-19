import * as React from 'react'

import {
  ButtonProps,
  PopoverRootProps,
  createContext,
  useDisclosure,
} from '@chakra-ui/react'

export interface TourDialogOptions extends PopoverRootProps {
  onSubmit?(): Promise<any>
  primaryAction?: ButtonProps | null
  secondaryAction?: ButtonProps | null
}

export type TourDialogContext = ReturnType<typeof useTourDialog>

export const [TourDialogContextProvider, useTourDialogContext] =
  createContext<TourDialogContext>()

export const useTourDialog = (props: TourDialogOptions) => {
  const {
    initialFocusEl,
    onSubmit,
    open: openProp,
    onOpenChange: onOpenChangeProp,
    defaultOpen,
    primaryAction,
    secondaryAction,
  } = props

  const initialFocusRef = React.useRef(initialFocusEl)

  const { open, onOpen, onClose, onToggle } = useDisclosure({
    defaultOpen,
    open: openProp,
    onOpen: () => onOpenChangeProp?.({ open: true }),
    onClose: () => onOpenChangeProp?.({ open: false }),
  })

  const primaryActionRef = React.useRef(null)

  const getPrimaryActionProps = React.useCallback(
    (props: ButtonProps): ButtonProps => {
      return {
        children: 'OK',
        ...primaryAction,
        ...props,
      }
    },
    [onSubmit, onClose, primaryActionRef],
  )

  const getSecondaryActionProps = React.useCallback(
    (props: ButtonProps): ButtonProps => {
      return {
        children: 'Dismiss',
        ...secondaryAction,
        ...props,
      }
    },
    [onClose],
  )

  return {
    initialFocusRef: initialFocusRef || primaryActionRef,
    open,
    onOpen,
    onClose,
    onToggle,
    getPrimaryActionProps,
    getSecondaryActionProps,
    primaryActionRef,
  }
}
