import * as React from 'react'

import { Button, ButtonProps } from '@chakra-ui/react'
import { Link, createLink } from '@tanstack/react-router'

export interface LinkButtonProps extends ButtonProps {
  href?: string | object
}

export const LinkButton = createLink(
  React.forwardRef(function LinkButton(
    props: LinkButtonProps,
    ref: React.ForwardedRef<HTMLAnchorElement>,
  ) {
    return (
      <Button
        as={Link}
        {...props}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
      />
    )
  }),
)
