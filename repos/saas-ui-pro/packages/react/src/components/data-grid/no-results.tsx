'use client'

import * as React from 'react'

import { Button, HStack } from '@chakra-ui/react'
import { EmptyState } from '@chakra-ui/react'

import { useDataGridContext } from './data-grid-context'

export interface NoResultsProps extends Omit<EmptyState.RootProps, 'title'> {
  title?: string
  resource?: string
  clearLabel?: string
  onReset?(): void
}

export const NoResults: React.FC<NoResultsProps> = (props) => {
  const { state } = useDataGridContext()

  const count = state.columnFilters.length

  const {
    resource = 'results',
    title = state.globalFilter
      ? `No ${resource} found for "${state.globalFilter}"`
      : count
        ? `No ${resource} matching ${count} filters.`
        : `No ${resource}.`,
    clearLabel = 'Clear filters',
    onReset,
    ...rest
  } = props

  const rootProps = {
    variant: 'no-results',
    ...rest,
  }

  return (
    <EmptyState.Root {...rootProps}>
      <EmptyState.Content>
        <EmptyState.Description>{title}</EmptyState.Description>
        {!!state.columnFilters.length && (
          <HStack justifyContent="center">
            <Button onClick={onReset} variant="ghost" size="xs">
              {clearLabel}
            </Button>
          </HStack>
        )}
      </EmptyState.Content>
    </EmptyState.Root>
  )
}
