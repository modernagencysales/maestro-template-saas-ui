import { describe, expect, it } from 'vitest'

import { shouldPersistBrainMarkdown } from './brain-page-editor-state'

describe('Brain page editor persistence decision', () => {
  it('saves only changed live pages', () => {
    expect(
      shouldPersistBrainMarkdown({
        fixtureRuntime: false,
        loadedMarkdown: '# current',
        draftMarkdown: '# changed',
      }),
    ).toBe(true)
    expect(
      shouldPersistBrainMarkdown({
        fixtureRuntime: true,
        loadedMarkdown: '# current',
        draftMarkdown: '# changed',
      }),
    ).toBe(false)
    expect(
      shouldPersistBrainMarkdown({
        fixtureRuntime: false,
        loadedMarkdown: '# current',
        draftMarkdown: '# current',
      }),
    ).toBe(false)
  })
})
