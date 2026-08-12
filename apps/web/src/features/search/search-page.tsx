"use client";

import {
  Avatar,
  Box,
  EmptyState,
  GridList,
  Heading,
  LoadingOverlay,
  Page,
  Text,
} from "@saas-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  linkOptions,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { LuSearch, LuX } from "react-icons/lu";

import type { ContactDTO } from "@workspace/api/types";
import { SearchInput } from "@workspace/ui/search-input";

import { LinkButton } from "#components/link-button";

export function SearchPage() {
  const navigate = useNavigate();

  const { q } = useSearch({
    from: "/_workspace/_dashboard/search",
  });

  const setSearch = (q: string) => {
    navigate({
      from: "/search",
      to: ".",
      search: {
        q,
      },
    });
  };

  const { data } = useQuery({
    queryKey: ["search", q],
    queryFn: async (): Promise<ContactDTO[]> => {
      // TODO: Implement search
      return [];
    },
    enabled: !!q,
  });

  return (
    <Page.Root>
      <Page.Header
        display="block"
        minH="10"
        py="1"
        title={
          <SearchInput
            placeholder="Search your workspace..."
            value={q ?? ""}
            onChange={(e) => setSearch(e.target.value)}
            onReset={() => setSearch("")}
            width="full"
            border="0"
          />
        }
      />
      <Page.Body p="0">
        {q ? (
          <SearchResults {...(data ? { data } : {})} search={q} />
        ) : (
          <RecentSearches />
        )}
      </Page.Body>
    </Page.Root>
  );
}

function RecentSearches() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["recent-searches"],
    queryFn: async () => {
      return ["hello", "james", "kira"];
    },
  });

  const clearRecent = useMutation({
    mutationFn: async () => {
      queryClient.setQueryData(["recent-searches"], []);
    },
  });

  const getSearchLinkOptions = (q: string) =>
    linkOptions({
      to: "/search",
      params: {},
      search: {
        q,
      },
    });

  if (!data?.length) {
    return null;
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
          <GridList.Item
            px="5"
            py="2"
            onClick={() => {
              clearRecent.mutate();
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
  );
}

function SearchResults(props: { data?: ContactDTO[]; search: string }) {
  const getLinkOptions = (id: string) =>
    linkOptions({
      to: "/contacts/view/$id",
      params: {
        id,
      },
    });

  if (props.search && !props.data?.length) {
    return (
      <EmptyState
        title="No results"
        description={`No results for for query "${props.search}"`}
      >
        <LinkButton to="/search" search={{ q: "" }}>
          Clear search
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <Box>
      <Heading as="h4" size="sm" color="fg.muted" px="5" py="2">
        Results
      </Heading>
      <GridList.Root interactive>
        {props.data?.map((contact) => (
          <GridList.Item key={contact.id} textStyle="sm" px="5" py="2" asChild>
            <Link {...getLinkOptions(contact.id)}>
              <GridList.Cell>
                <Avatar
                  name={contact.name ?? contact.email ?? ""}
                  {...(contact.avatar ? { src: contact.avatar } : {})}
                  size="2xs"
                />
              </GridList.Cell>
              <GridList.Cell flex="1">
                <Text>{contact.name}</Text>
              </GridList.Cell>
            </Link>
          </GridList.Item>
        ))}
      </GridList.Root>
    </Box>
  );
}
