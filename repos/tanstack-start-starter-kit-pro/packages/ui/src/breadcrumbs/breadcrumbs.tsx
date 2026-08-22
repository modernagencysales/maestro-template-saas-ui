import { Fragment } from 'react'

import { SkeletonText, Text } from '@chakra-ui/react'
import { Breadcrumb, Link } from '@saas-ui/react'

export interface BreadcrumbsItem {
  isCurrentPage?: boolean
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
      {items?.map((item, i) => {
        const { href, title, isCurrentPage } = item

        return (
          <Fragment key={i}>
            {href ? (
              <Breadcrumb.Link
                as={Link}
                href={href}
                fontWeight="semibold"
                _hover={{
                  textDecoration: 'none',
                }}
              >
                {title}
              </Breadcrumb.Link>
            ) : title ? (
              <Breadcrumb.CurrentLink>
                <Text color={isCurrentPage ? 'fg' : 'muted'}>{title}</Text>
              </Breadcrumb.CurrentLink>
            ) : (
              <SkeletonText width="28" noOfLines={1} />
            )}
          </Fragment>
        )
      })}
    </Breadcrumb.Root>
  )
}
