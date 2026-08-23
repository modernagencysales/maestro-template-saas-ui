import { describe, expect, it } from 'vitest'

import {
  brainInboxFixtures,
  projectBrainPagesToInbox,
} from './brain-inbox-adapter'

describe('Brain pages to Starter Inbox adapter', () => {
  it('projects behavior data without changing the Starter row contract', () => {
    expect(
      projectBrainPagesToInbox([
        {
          _id: 'brain-page-1',
          title: 'Client positioning',
          sourceKind: 'markdown',
          updatedAt: 1_782_924_800_000,
        },
      ]),
    ).toEqual({
      notifications: [
        {
          id: 'brain-page-1',
          subjectId: 'brain-page-1',
          actorId: null,
          readAt: new Date(1_782_924_800_000),
          createdAt: new Date(1_782_924_800_000),
          type: 'update',
          subject: { name: 'Client positioning' },
          metadata: { field: 'source', value: 'markdown' },
        },
      ],
    })
  })

  it('ships a populated fake-safe Brain state', () => {
    expect(projectBrainPagesToInbox(brainInboxFixtures).notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: { name: 'Client overview' } }),
      ]),
    )
  })
})
