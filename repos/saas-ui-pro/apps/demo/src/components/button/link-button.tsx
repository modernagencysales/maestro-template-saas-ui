import * as React from 'react'

import { Button, type ButtonProps } from '@chakra-ui/react'
import Link, { LinkProps } from 'next/link'

export interface LinkButtonProps
  extends Omit<LinkProps, 'legacyBehavior'>,
    Omit<ButtonProps, keyof LinkProps> {
  target?: '_blank' | '_self' | '_parent' | '_top'
}

export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(props, ref) {
    const {
      as,
      href,
      prefetch,
      replace,
      scroll,
      shallow,
      passHref,
      locale,
      onMouseEnter,
      onTouchStart,
      onClick,
      children,
      ...buttonProps
    } = props
    return (
      <Button {...buttonProps} _hover={{ textDecoration: 'none' }} asChild>
        <Link
          as={as}
          ref={ref}
          href={href}
          prefetch={prefetch}
          replace={replace}
          scroll={scroll}
          shallow={shallow}
          passHref={passHref}
          locale={locale}
          onMouseEnter={onMouseEnter}
          onTouchStart={onTouchStart}
          onClick={onClick}
        >
          {children}
        </Link>
      </Button>
    )
  },
)
