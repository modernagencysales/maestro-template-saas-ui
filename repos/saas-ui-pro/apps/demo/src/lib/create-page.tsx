import React from 'react'

import {
  HydrationBoundary,
  type QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import { Metadata, type ResolvingMetadata } from 'next'
import type { z } from 'zod'

import { getQueryClient } from '#features/common/lib/react-query.ts'

export const createPage = <
  const Params extends readonly string[] | z.ZodAny,
  const SearchParams extends readonly string[] | z.ZodAny,
  Loader extends LoaderFn<Params, SearchParams> = LoaderFn<
    Params,
    SearchParams
  >,
>(
  props: CreatePageProps<Params, SearchParams, Loader>,
) => {
  const {
    params: paramsSchema,
    searchParams: searchParamsSchema,
    renderComponent: RenderComponent,
    title,
    metadata,
    loader,
  } = props

  async function Page(props: any) {
    const params = parseParams(await props.params, paramsSchema)
    const searchParams = parseParams(
      await props.searchParams,
      searchParamsSchema,
    )

    if (loader) {
      const queryClient = getQueryClient()
      const data = await loader({ params, searchParams, queryClient })

      const dehydratedState = dehydrate(queryClient)

      return (
        <HydrationBoundary state={dehydratedState}>
          <RenderComponent
            {...props}
            params={params}
            searchParams={searchParams}
            data={data}
          />
        </HydrationBoundary>
      )
    }

    return (
      <RenderComponent {...props} params={params} searchParams={searchParams} />
    )
  }

  return {
    metadata: {
      title,
      ...metadata,
    },
    Page,
  }
}

type InferParams<Params> = Params extends readonly string[]
  ? {
      [K in Params[number]]: string
    }
  : Params extends z.ZodAny
    ? z.infer<Params>
    : Record<string, string>

type LoaderFn<
  Params extends readonly string[] | z.ZodAny,
  SearchParams extends readonly string[] | z.ZodAny,
> = (args: {
  params: InferParams<Params>
  searchParams: InferParams<SearchParams>
  queryClient: QueryClient
}) => Promise<any>

type InferLoaderData<Loader> = Loader extends (args: any) => Promise<infer T>
  ? T
  : undefined

export interface CreatePageProps<
  Params extends readonly string[] | z.ZodAny,
  SearchParams extends readonly string[] | z.ZodAny,
  Loader extends LoaderFn<Params, SearchParams> = LoaderFn<
    Params,
    SearchParams
  >,
> {
  title?: string
  params?: Params
  searchParams?: SearchParams
  loader?: Loader
  metadata?:
    | Metadata
    | ((
        args: {
          params: InferParams<Params>
          searchParams: InferParams<SearchParams>
          data: InferLoaderData<Loader>
        },
        parent: ResolvingMetadata,
      ) => Promise<Metadata>)
  renderComponent: React.ComponentType<{
    params: InferParams<Params>
    searchParams?: InferParams<SearchParams>
    data: InferLoaderData<Loader>
    [key: string]: any
  }>
}

function parseParams<Schema extends readonly string[] | z.ZodAny>(
  params: Record<string, string>,
  schema?: Schema,
) {
  if (schema && 'parse' in schema) {
    return schema.parse(params) as InferParams<Schema>
  }

  return params as InferParams<Schema>
}
