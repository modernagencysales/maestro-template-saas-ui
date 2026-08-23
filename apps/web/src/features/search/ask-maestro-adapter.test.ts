import { describe, expect, it } from 'vitest'

import {
  askMaestroPromptFixtures,
  projectAssistantMessagesToSearchResults,
} from './ask-maestro-adapter'

describe('assistant to Starter Search adapter', () => {
  it('projects assistant messages into the Starter results contract', () => {
    expect(
      projectAssistantMessagesToSearchResults([
        {
          id: 'message-1',
          role: 'assistant',
          content: 'Three clients need follow-up this week.',
          createdAt: 1,
        },
        {
          id: 'message-2',
          role: 'user',
          content: 'What needs attention?',
          createdAt: 2,
        },
      ]),
    ).toEqual([
      {
        id: 'message-1',
        title: 'Maestro',
        description: 'Three clients need follow-up this week.',
      },
    ])
  })

  it('ships useful fake-safe prompt ideas', () => {
    expect(askMaestroPromptFixtures).toContain('What needs my attention today?')
  })
})
