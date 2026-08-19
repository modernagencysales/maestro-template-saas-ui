'use client'

import { forwardRef } from 'react'

import {
  Button,
  Pagination as ChakraPagination,
  IconButton,
  createContext,
  usePaginationContext,
} from '@chakra-ui/react'

import { ChevronLeftIcon, ChevronRightIcon } from '../icons'

interface PaginationContextValue {
  size?: React.ComponentProps<typeof Button>['size']
}

const [PaginationProvider, usePaginationProps] =
  createContext<PaginationContextValue>({
    name: 'DataGridPaginationProvider',
  })

export interface PaginationRootProps extends ChakraPagination.RootProps {
  size?: React.ComponentProps<typeof Button>['size']
}

const Root = forwardRef<HTMLDivElement, PaginationRootProps>(
  function PaginationRoot(props, ref) {
    const { size = 'sm', ...rest } = props
    return (
      <PaginationProvider value={{ size }}>
        <ChakraPagination.Root ref={ref} type="button" {...rest} />
      </PaginationProvider>
    )
  },
)

const Item = forwardRef<HTMLButtonElement, ChakraPagination.ItemProps>(
  function PaginationItem(props, ref) {
    const { page } = usePaginationContext()
    const { size } = usePaginationProps()
    return (
      <ChakraPagination.Item ref={ref} {...props} asChild>
        <Button
          variant={page === props.value ? 'outline' : 'ghost'}
          size={size}
        >
          {props.value}
        </Button>
      </ChakraPagination.Item>
    )
  },
)

const PrevButton = forwardRef<
  HTMLButtonElement,
  ChakraPagination.PrevTriggerProps
>(function PaginationPrevButton(props, ref) {
  const { size } = usePaginationProps()
  return (
    <ChakraPagination.PrevTrigger ref={ref} asChild {...props}>
      <IconButton variant="ghost" size={size}>
        {props.children ?? <ChevronLeftIcon />}
      </IconButton>
    </ChakraPagination.PrevTrigger>
  )
})

const NextButton = forwardRef<
  HTMLButtonElement,
  ChakraPagination.NextTriggerProps
>(function PaginationNextButton(props, ref) {
  const { size } = usePaginationProps()
  return (
    <ChakraPagination.NextTrigger ref={ref} asChild {...props}>
      <IconButton variant="ghost" size={size}>
        {props.children ?? <ChevronRightIcon />}
      </IconButton>
    </ChakraPagination.NextTrigger>
  )
})

function Items(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <ChakraPagination.Context>
      {({ pages }) =>
        pages.map((page, index) =>
          page.type === 'ellipsis' ? (
            <ChakraPagination.Ellipsis key={index} index={index} {...props} />
          ) : (
            <Item key={index} type="page" value={page.value} {...props} />
          ),
        )
      }
    </ChakraPagination.Context>
  )
}

export const Pagination = {
  Root,
  Item,
  Items,
  PrevButton,
  NextButton,
  Ellipsis: ChakraPagination.Ellipsis,
}
