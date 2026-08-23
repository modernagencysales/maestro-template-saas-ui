'use client'

import * as React from 'react'

import {
  getFunctionReference,
  templateConfectRefs,
} from '@maestro-template/convex/refs'
import { useConvexQuery } from '@convex-dev/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { Editor } from '@workspace/ui/editor'
import { LuFileText } from 'react-icons/lu'

import { productShell } from '#config/product-shell'
import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { isFixtureAuthRuntime } from '#lib/auth/route-auth'

import { brainInboxFixtures } from './brain-inbox-adapter'
import { shouldPersistBrainMarkdown } from './brain-page-editor-state'
import { ContactPageComposition } from '../view/contact-page'

const getPageRef = getFunctionReference(templateConfectRefs.public.brain.pages.get)
const updatePageRef = getFunctionReference(
  templateConfectRefs.public.brain.pages.updateMarkdown,
)

const fixtureMarkdown = `# Client overview

Use this shared page to keep the client's context, positioning, decisions, and next steps current.`

type BrainEditorPage = Readonly<{
  _id: string
  title: string
  markdown: string
  updatedAt: number
}>

const fixturePage = (pageId: string): BrainEditorPage => {
  const fixture = brainInboxFixtures.find((page) => page._id === pageId)
  return {
    _id: fixture?._id ?? pageId,
    title: fixture?.title ?? 'Agency Brain page',
    markdown: fixtureMarkdown,
    updatedAt: fixture?.updatedAt ?? 1_782_924_800_000,
  }
}

const useBrainPage = (input: {
  fixtureRuntime: boolean
  pageId: string
  workspaceId: string
}): BrainEditorPage | undefined => {
  const query = useConvexQuery(
    getPageRef,
    input.fixtureRuntime
      ? 'skip'
      : { workspaceId: input.workspaceId, pageId: input.pageId as never },
  )
  return input.fixtureRuntime
    ? fixturePage(input.pageId)
    : (query.data as BrainEditorPage | undefined)
}

const useBrainMarkdown = (input: {
  fixtureRuntime: boolean
  page: BrainEditorPage | undefined
  workspaceId: string
}) => {
  const updateMarkdown = useConvexMutation(updatePageRef)
  const [markdown, setMarkdown] = React.useState(input.page?.markdown ?? '')
  const revisionRef = React.useRef(input.page?.updatedAt ?? 0)

  React.useEffect(() => {
    setMarkdown(input.page?.markdown ?? '')
    revisionRef.current = input.page?.updatedAt ?? 0
  }, [input.page?._id, input.page?.markdown, input.page?.updatedAt])

  React.useEffect(() => {
    if (
      !input.page ||
      !shouldPersistBrainMarkdown({
        fixtureRuntime: input.fixtureRuntime,
        loadedMarkdown: input.page.markdown,
        draftMarkdown: markdown,
      })
    )
      return
    const timeout = window.setTimeout(() => {
      if (!input.page) return
      void updateMarkdown({
        workspaceId: input.workspaceId,
        pageId: input.page._id,
        markdown,
        expectedUpdatedAt: revisionRef.current,
      }).then((updated) => {
        revisionRef.current = updated.updatedAt
      })
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [input.fixtureRuntime, input.page, input.workspaceId, markdown, updateMarkdown])

  return { markdown, setMarkdown } as const
}

export function BrainInboxViewPage({
  params,
  toolbarItems,
}: {
  params: { workspace: string; id: string }
  toolbarItems?: React.ReactNode
}) {
  const [workspace] = useCurrentWorkspace()
  const fixtureRuntime = isFixtureAuthRuntime()
  const page = useBrainPage({
    fixtureRuntime,
    pageId: params.id,
    workspaceId: workspace.id,
  })
  const { markdown, setMarkdown } = useBrainMarkdown({
    fixtureRuntime,
    page,
    workspaceId: workspace.id,
  })

  return (
    <ContactPageComposition
      params={params}
      toolbarItems={toolbarItems}
      rootLabel={productShell.labels.inbox}
      rootTo="/$workspace/inbox"
      title={page?.title ?? 'Loading page'}
      primaryLabel="Page"
      primaryIcon={<LuFileText />}
      primaryContent={
        <Editor
          aria-label="Agency Brain page editor"
          value={markdown}
          onChange={setMarkdown}
          minH="60vh"
        />
      }
    />
  )
}
