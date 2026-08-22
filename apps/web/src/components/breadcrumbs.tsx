import * as React from "react";

import {
  Breadcrumb,
  BreadcrumbLink as ChakraBreadcrumbLink,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { type LinkProps, createLink } from "@tanstack/react-router";

export interface BreadcrumbsItem
  extends
    Omit<Breadcrumb.ItemProps, "title">,
    Partial<Pick<LinkProps, "to" | "params">> {
  title?: React.ReactNode;
}

export interface BreadCrumbsProps extends Breadcrumb.RootProps {
  items: BreadcrumbsItem[];
}

/**
 * Breadcrumbs helper component.
 *
 * Wraps breadcrumb links to work with your router.
 * Renders items without a title as a Skeleton animation.
 */
export const Breadcrumbs: React.FC<BreadCrumbsProps> = (props) => {
  const { items = [], ...rest } = props;
  return (
    <Breadcrumb.Root fontSize="sm" {...rest}>
      <Breadcrumb.List>
        {items?.map((item, i) => {
          const { to, params, title, ...itemProps } = item;

          return (
            <React.Fragment key={i}>
              <Breadcrumb.Item key={i} {...itemProps}>
                {to ? (
                  <BreadcrumbLink
                    to={to}
                    params={params}
                    fontWeight="medium"
                    color="fg"
                    _hover={{
                      textDecoration: "none",
                    }}
                  >
                    {title}
                  </BreadcrumbLink>
                ) : title ? (
                  <Text color="muted">{title}</Text>
                ) : (
                  <Skeleton width="28" height="0.6em" />
                )}
              </Breadcrumb.Item>
              {i < items.length - 1 && <Breadcrumb.Separator />}
            </React.Fragment>
          );
        })}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );
};

const BreadcrumbLink = createLink(ChakraBreadcrumbLink);
