'use client'

import {
  Avatar,
  Box,
  EmptyState,
  GridList,
  Heading,
  LoadingOverlay,
  Page,
  Text,
} from '@saas-ui/react'
import {
  getFunctionReference,
  templateConfectRefs,
} from '@maestro-template/convex/refs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAction as useConvexAction } from 'convex/react'
import {
  Link,
  linkOptions,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { LuSearch, LuX } from 'react-icons/lu'

import { SearchInput } from '@workspace/ui/search-input'

import { productShell } from '#config/product-shell'
import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { useWorkspaceSlug } from '#features/common/hooks/use-workspace-slug'
import { isFixtureAuthRuntime } from '#lib/auth/route-auth'

import {
  askMaestroPromptFixtures,
  fakeAskMaestroResult,
  projectAssistantMessagesToSearchResults,
  type StarterSearchResult,
} from './ask-maestro-adapter'

const startAssistantThreadRef = getFunctionReference(
  templateConfectRefs.public.agents.assistant.startThread,
)

export function SearchPage() {
  const navigate = useNavigate()
  const [workspace] = useCurrentWorkspace()
  const startAssistantThread = useConvexAction(startAssistantThreadRef)

  const { q } = useSearch({
    from: '/_app/$workspace/_dashboard/search',
  })

  const setSearch = (q: string) => {
    navigate({
      from: '/$workspace/search',
      to: '.',
      search: {
        q,
      },
    })
  }

  const { data } = useQuery({
    queryKey: ['search', productShell.search, q],
    queryFn: async () => {
      if (productShell.search !== 'assistant') return []
      if (isFixtureAuthRuntime()) return fakeAskMaestroResult(q)
      const result = await startAssistantThread({
        workspaceId: workspace.id,
        firstMessage: q,
      })
      return projectAssistantMessagesToSearchResults(result.messages)
    },
    enabled: !!q,
  })

  return (
    <Page.Root>
      <Page.Header
        display="block"
        minH="10"
        py="1"
        title={
          <SearchInput
            placeholder={
              productShell.search === 'assistant'
                ? 'Ask Maestro anything...'
                : 'Search your workspace...'
            }
            value={q}
            onChange={(e) => setSearch(e.target.value)}
            onReset={() => setSearch('')}
            width="full"
            border="0"
          />
        }
      />
      <Page.Body p="0">
        {q ? <SearchResults data={data} search={q} /> : <RecentSearches />}
      </Page.Body>
    </Page.Root>
  )
}

function RecentSearches() {
  const queryClient = useQueryClient()

  const workspace = useWorkspaceSlug()

  const { data, isLoading } = useQuery({
    queryKey: ['recent-searches', productShell.search],
    queryFn: async () => {
      return productShell.search === 'assistant'
        ? [...askMaestroPromptFixtures]
        : ['hello', 'james', 'kira']
    },
  })

  const clearRecent = useMutation({
    mutationFn: async () => {
      queryClient.setQueryData(['recent-searches', productShell.search], [])
    },
  })

  const getSearchLinkOptions = (q: string) =>
    linkOptions({
      to: '/$workspace/search',
      params: {
        workspace,
      },
      search: {
        q,
      },
    })

  if (!data?.length) {
    return null
  }

  return (
    <Box>
      <Heading as="h4" size="sm" color="fg.muted" px="5" py="2">
        {productShell.search === 'assistant'
          ? 'Try asking Maestro'
          : 'Recent searches'}
      </Heading>
      {isLoading ? (
        <LoadingOverlay.Root>
          <LoadingOverlay.Spinner />
        </LoadingOverlay.Root>
      ) : data.length > 0 ? (
        <GridList.Root interactive>
          {data.map((item) => (
            <GridList.Item key={item} textStyle="sm" px="5" py="2" asChild>
              <Link {...getSearchLinkOptions(item)} role="row">
                <GridList.Cell>
                  <LuSearch />
                </GridList.Cell>
                <GridList.Cell flex="1">
                  <Text>{item}</Text>
                </GridList.Cell>
              </Link>
            </GridList.Item>
          ))}
          {productShell.search === 'workspace' ? (
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
          ) : null}
        </GridList.Root>
      ) : null}
    </Box>
  )
}

function SearchResults(props: {
  data?: StarterSearchResult[]
  search: string
}) {
  if (props.search && !props.data?.length) {
    return (
      <EmptyState
        title={
          productShell.search === 'assistant' ? 'No answer yet' : 'No results'
        }
        description={`No results for query "${props.search}"`}
      />
    )
  }

  return (
    <Box>
      <Heading as="h4" size="sm" color="fg.muted" px="5" py="2">
        Results
      </Heading>
      <GridList.Root interactive>
        {props.data?.map((result) => (
          <GridList.Item key={result.id} textStyle="sm" px="5" py="3">
            <GridList.Cell>
              <Avatar name={result.title} size="2xs" />
            </GridList.Cell>
            <GridList.Cell flex="1">
              <Text fontWeight="medium">{result.title}</Text>
              <Text color="fg.muted">{result.description}</Text>
            </GridList.Cell>
          </GridList.Item>
        ))}
      </GridList.Root>
    </Box>
  )
}
