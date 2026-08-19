import React from 'react'

import { Breadcrumb, Text } from '@chakra-ui/react'

import { Skeleton } from '#ui/skeleton/skeleton'

import { Link } from '../link'

export interface BreadcrumbsItem extends Omit<Breadcrumb.ItemProps, 'title'> {
  title?: React.ReactNode
  href?: string
}

export interface BreadCrumbsProps extends Breadcrumb.RootProps {
  items: BreadcrumbsItem[]
}

/**
 * Breadcrumbs helper component.
 *
 * Wraps breadcrumb links to work with your router.
 * Renders items without a title as a Skeleton animation.
 */
export const Breadcrumbs: React.FC<BreadCrumbsProps> = (props) => {
  const { items = [], ...rest } = props
  return (
    <Breadcrumb.Root {...rest}>
      <Breadcrumb.List>
        {items?.map((item, i) => {
          const { href, title, ...itemProps } = item

          return (
            <React.Fragment key={i}>
              <Breadcrumb.Item key={i} {...itemProps} fontSize="sm">
                {href ? (
                  <Breadcrumb.Link
                    as={Link}
                    href={href}
                    fontWeight="medium"
                    _hover={{
                      textDecoration: 'none',
                    }}
                  >
                    {title}
                  </Breadcrumb.Link>
                ) : title ? (
                  <Text color="muted">{title}</Text>
                ) : (
                  <Skeleton width="28" height="0.6em" />
                )}
              </Breadcrumb.Item>

              {i < items.length - 1 && <Breadcrumb.Separator />}
            </React.Fragment>
          )
        })}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  )
}
