'use client'

import { useState } from 'react'

import { Box, Heading, Text } from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { LuSearch, LuX } from 'react-icons/lu'

import * as GridList from '#ui/grid-list/grid-list'
import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'
import * as Page from '#ui/page/page'
import { type Contact, getContacts } from '#api'
import { SearchInput } from '#components/search-input/search-input.tsx'
import { usePath } from '#features/common/hooks/use-path.ts'
import { Avatar } from '#ui/avatar/avatar'
import { EmptyState } from '#ui/empty-state/empty-state'

export function SearchPage() {
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['search', search],
    queryFn: async () => {
      const { contacts } = await getContacts({})

      return contacts.filter((contact) =>
        contact.name.toLowerCase().includes(search.toLowerCase()),
      )
    },
    enabled: !!search,
  })

  return (
    <Page.Root>
      <Page.Header
        display="block"
        minH="10"
        py="1"
        title={
          <SearchInput
            placeholder="Search your workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onReset={() => setSearch('')}
            width="full"
            border="0"
          />
        }
      />
      <Page.Body p="0">
        {search ? (
          <SearchResults data={data} search={search} />
        ) : (
          <RecentSearches />
        )}
      </Page.Body>
    </Page.Root>
  )
}

function RecentSearches() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['recent-searches'],
    queryFn: async () => {
      return ['hello', 'james', 'kira']
    },
  })

  const clearRecent = useMutation({
    mutationFn: async () => {
      queryClient.setQueryData(['recent-searches'], [])
    },
  })

  if (!data?.length) {
    return null
  }

  return (
    <Box>
      <Heading as="h4" size="sm" color="fg.muted" px="5" py="2">
        Recent searches
      </Heading>
      {isLoading ? (
        <LoadingOverlay.Root>
          <LoadingOverlay.Spinner />
        </LoadingOverlay.Root>
      ) : data.length > 0 ? (
        <GridList.Root interactive>
          {data.map((item) => (
            <GridList.Item key={item} textStyle="sm" px="5" py="2" asChild>
              <Link href="/" role="row">
                <GridList.Cell>
                  <LuSearch />
                </GridList.Cell>
                <GridList.Cell flex="1">
                  <Text>{item}</Text>
                </GridList.Cell>
              </Link>
            </GridList.Item>
          ))}
          <GridList.Item
            px="5"
            py="2"
            onClick={() => {
              clearRecent.mutate()
            }}
          >
            <GridList.Cell>
              <LuX />
            </GridList.Cell>
            <GridList.Cell flex="1" color="fg.subtle" textStyle="sm">
              Clear recent searches
            </GridList.Cell>
          </GridList.Item>
        </GridList.Root>
      ) : null}
    </Box>
  )
}

function SearchResults(props: { data?: Contact[]; search: string }) {
  const basePath = usePath('/')

  if (props.search && !props.data?.length) {
    return (
      <EmptyState
        title="No results"
        description={`No results for for query "${props.search}"`}
      />
    )
  }

  return (
    <Box>
      <Heading as="h4" size="sm" color="fg.muted" px="5" py="2">
        Results
      </Heading>
      <GridList.Root interactive>
        {props.data?.map((contact) => (
          <GridList.Item key={contact.id} textStyle="sm" px="5" py="2" asChild>
            <Link href={`${basePath}/contacts/${contact.id}`}>
              <GridList.Cell>
                <Avatar name={contact.name} src={contact.avatar} size="2xs" />
              </GridList.Cell>
              <GridList.Cell flex="1">
                <Text>{contact.name}</Text>
              </GridList.Cell>
            </Link>
          </GridList.Item>
        ))}
      </GridList.Root>
    </Box>
  )
}
