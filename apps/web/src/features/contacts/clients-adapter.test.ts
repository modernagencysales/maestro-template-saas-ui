import { describe, expect, it } from 'vitest'

import {
  clientWorkspaceFixtures,
  contactsListDataHooks,
  projectClientWorkspaceToContact,
  projectClientWorkspacesToContacts,
  starterContactsListInput,
} from './clients-adapter'

describe('client workspaces to Starter Contacts adapter', () => {
  it('projects client identity into the untouched Starter contact contract', () => {
    expect(
      projectClientWorkspaceToContact({
        _id: 'workspace-northstar',
        slug: 'northstar',
        name: 'Northstar Labs',
        status: 'active',
        createdAt: 1_782_924_800_000,
        updatedAt: 1_782_928_400_000,
      }),
    ).toEqual({
      id: 'workspace-northstar',
      workspaceId: 'workspace-northstar',
      name: 'Northstar Labs',
      email: 'northstar@client.maestro.local',
      avatar: null,
      status: 'active',
      type: 'customer',
      tags: ['Client'],
      sortOrder: null,
      createdAt: new Date(1_782_924_800_000),
      updatedAt: new Date(1_782_928_400_000),
    })
  })

  it('ships populated fake-safe Clients data', () => {
    expect(projectClientWorkspacesToContacts(clientWorkspaceFixtures).contacts)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Northstar Labs' }),
          expect.objectContaining({ name: 'Juniper Works' }),
        ]),
      )
  })

  it('preserves the selected Starter contact type at the query adapter', () => {
    expect(
      starterContactsListInput({
        workspaceId: 'workspace-northstar',
        type: 'lead',
      }),
    ).toEqual({ workspaceId: 'workspace-northstar', type: 'lead' })
    expect(
      starterContactsListInput({ workspaceId: 'workspace-northstar' }),
    ).toEqual({ workspaceId: 'workspace-northstar' })
    expect(
      contactsListDataHooks.contacts({
        workspaceId: 'workspace-northstar',
        type: 'lead',
      }).data,
    ).toEqual({ contacts: [] })
  })
})
