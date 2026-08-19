import { describe, expect, it } from 'vitest'

import { reorderNavItems } from './sidebar4'

const items = [
  { id: 'lead', label: 'Lead' },
  { id: 'customer', label: 'Customer' },
  { id: 'partner', label: 'Partner' },
]

describe('reorderNavItems', () => {
  it('reorders from the current controlled items', () => {
    const currentItems = [items[2], items[0], items[1]]

    expect(
      reorderNavItems(currentItems, 'partner', 'customer').map(
        (item) => item.id,
      ),
    ).toEqual(['lead', 'customer', 'partner'])
  })

  it('keeps the current order for cancelled or stale identifiers', () => {
    expect(reorderNavItems(items, 'missing', 'lead')).toEqual(items)
    expect(reorderNavItems(items, 'lead', 'lead')).toEqual(items)
  })
})
