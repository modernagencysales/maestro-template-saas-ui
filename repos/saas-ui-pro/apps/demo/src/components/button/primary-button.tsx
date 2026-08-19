import { forwardRef } from 'react'

import { Button, type ButtonProps } from '@chakra-ui/react'

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  function PrimaryButton(props, ref) {
    return <Button ref={ref} {...props} variant="glass" colorPalette="accent" />
  },
)
