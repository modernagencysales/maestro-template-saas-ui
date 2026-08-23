import { useConvexQuery } from '@convex-dev/react-query'
import {
  getFunctionReference,
  templateConfectRefs,
} from '@maestro-template/convex/refs'
import type { ContactDTO, ContactType } from '@workspace/api/types'

import { isFixtureAuthRuntime } from '#lib/auth/route-auth'
import { api } from '#lib/trpc/react'

export type ClientWorkspace = Readonly<{
  _id: string
  slug: string
  name: string
  status: 'active' | 'archived'
  createdAt: number
  updatedAt: number
}>

type ContactsListDataResult = Readonly<{
  data: { contacts: ContactDTO[] }
  isLoading?: boolean
}>

type ContactDetailDataResult = Readonly<{
  data: ContactDTO | undefined
  isLoading?: boolean
}>

type ContactsListInput = Readonly<{
  workspaceId: string
  type?: ContactType
}>

export const projectClientWorkspaceToContact = (
  workspace: ClientWorkspace,
): ContactDTO => ({
  id: workspace._id,
  workspaceId: workspace._id,
  name: workspace.name,
  email: `${workspace.slug}@client.maestro.local`,
  avatar: null,
  status: workspace.status === 'active' ? 'active' : 'inactive',
  type: 'customer',
  tags: ['Client'],
  sortOrder: null,
  createdAt: new Date(workspace.createdAt),
  updatedAt: new Date(workspace.updatedAt),
})

export const projectClientWorkspacesToContacts = (
  workspaces: readonly ClientWorkspace[],
): { contacts: ContactDTO[] } => ({
  contacts: workspaces.map(projectClientWorkspaceToContact),
})

export const clientWorkspaceFixtures: readonly ClientWorkspace[] = [
  {
    _id: 'client-northstar',
    slug: 'northstar',
    name: 'Northstar Labs',
    status: 'active',
    createdAt: 1_782_924_800_000,
    updatedAt: 1_782_928_400_000,
  },
  {
    _id: 'client-juniper',
    slug: 'juniper',
    name: 'Juniper Works',
    status: 'active',
    createdAt: 1_782_406_400_000,
    updatedAt: 1_782_838_400_000,
  },
]

const clientWorkspacesListRef = getFunctionReference(
  templateConfectRefs.public.auth.workspaces.list,
)

const useClientsList = ({
  workspaceId,
  type,
}: ContactsListInput): ContactsListDataResult => {
  void workspaceId
  void type
  const fixtureRuntime = isFixtureAuthRuntime()
  const result = useConvexQuery(
    clientWorkspacesListRef,
    fixtureRuntime ? 'skip' : {},
  )
  return {
    data: projectClientWorkspacesToContacts(
      fixtureRuntime ? clientWorkspaceFixtures : (result.data ?? []),
    ),
    isLoading: fixtureRuntime ? false : result.isLoading,
  }
}

export const starterContactsListInput = ({
  workspaceId,
  type,
}: ContactsListInput): { workspaceId: string; type?: ContactType } =>
  type === undefined ? { workspaceId } : { workspaceId, type }

const useStarterContactsList = (input: ContactsListInput) =>
  api.contacts.listByType.useQuery(
    starterContactsListInput(input),
  ) as ContactsListDataResult

const useClientDetail = ({
  id,
}: {
  id: string
  workspaceId: string
}): ContactDetailDataResult => {
  const fixtureRuntime = isFixtureAuthRuntime()
  const result = useConvexQuery(
    clientWorkspacesListRef,
    fixtureRuntime ? 'skip' : {},
  )
  const workspaces: readonly ClientWorkspace[] = fixtureRuntime
    ? clientWorkspaceFixtures
    : (result.data ?? [])
  const workspace = workspaces.find((candidate) => candidate._id === id)
  return {
    data: workspace ? projectClientWorkspaceToContact(workspace) : undefined,
    isLoading: fixtureRuntime ? false : result.isLoading,
  }
}

const useStarterContactDetail = (input: {
  id: string
  workspaceId: string
}): ContactDetailDataResult => {
  const [data, result] = api.contacts.byId.useSuspenseQuery(input)
  return { ...result, data }
}

export const contactsListDataHooks = {
  clients: useClientsList,
  contacts: useStarterContactsList,
} as const

export const contactDetailDataHooks = {
  clients: useClientDetail,
  contacts: useStarterContactDetail,
} as const
