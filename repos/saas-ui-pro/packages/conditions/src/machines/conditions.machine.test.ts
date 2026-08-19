import { describe, expect, it, vi } from 'vitest'

import { ConditionItem } from '#types/condition.types'

import { connect, machine } from './conditions.machine'

describe('conditions machine', () => {
  it('should add a condition', () => {
    const actions = machine.implementations.actions
    const setContext = vi.fn()
    const prop = (key: string) => {
      if (key === 'conditions')
        return [{ id: 'test', label: 'Test', type: 'string' }]
      return undefined
    }

    const mockContext = {
      get: (key: string) => {
        if (key === 'activeConditions') return []
        return undefined
      },
      set: setContext,
    }

    actions.addCondition({
      context: mockContext as any,
      prop: prop as any,
      event: {
        type: 'ADD_CONDITION',
        condition: { id: 'test', value: 'foo' },
      } as any,
    } as any)

    expect(setContext).toHaveBeenCalledWith(
      'activeConditions',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test',
          value: 'foo',
          label: 'Test',
          type: 'string',
        }),
      ]),
    )
  })

  it('should update a condition', () => {
    const actions = machine.implementations.actions
    const setContext = vi.fn()

    const mockContext = {
      get: (key: string) => {
        if (key === 'activeConditions')
          return [{ key: 'c1', id: 'test', value: 'foo' }]
        return undefined
      },
      set: setContext,
    }

    actions.updateCondition({
      context: mockContext as any,
      prop: (() => []) as any,
      event: {
        type: 'UPDATE_CONDITION',
        key: 'c1',
        updates: { value: 'bar' },
      } as any,
    } as any)

    expect(setContext).toHaveBeenCalledWith('activeConditions', [
      expect.objectContaining({
        key: 'c1',
        value: 'bar',
      }),
    ])
  })

  it('should remove a condition', () => {
    const actions = machine.implementations.actions
    const setContext = vi.fn()

    const mockContext = {
      get: (key: string) => {
        if (key === 'activeConditions') return [{ key: 'c1', id: 'test' }]
        return undefined
      },
      set: setContext,
    }

    actions.removeCondition({
      context: mockContext as any,
      event: {
        type: 'REMOVE_CONDITION',
        key: 'c1',
      } as any,
    } as any)

    expect(setContext).toHaveBeenCalledWith('activeConditions', [])
  })

  it('should check and load items', async () => {
    const actions = machine.implementations.actions
    const send = vi.fn()
    const setContext = vi.fn()

    const items = [{ label: 'John Doe', value: 'john', id: 'john' }]
    const loadItems = vi.fn().mockResolvedValue(items)

    const conditions = [
      {
        id: 'assignee',
        label: 'Assignee',
        type: 'enum',
        items: loadItems,
      },
    ]

    const mockContext = {
      get: (key: string) => {
        if (key === 'activeConditions')
          return [{ key: 'c1', id: 'assignee', value: 'john' }]
        if (key === 'items') return {}
        if (key === 'loading') return {}
        return undefined
      },
      set: setContext,
    }

    await (actions as any).checkActiveConditions({
      context: mockContext as any,
      prop: ((key: string) => {
        if (key === 'conditions') return conditions
        return undefined
      }) as any,
      send,
    })

    expect(setContext).toHaveBeenCalledWith('loading', { assignee: true })

    // Wait for async
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(loadItems).toHaveBeenCalledWith({ id: 'assignee' })

    // Wait for async promise resolution
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(send).toHaveBeenCalledWith({
      type: 'ITEMS_LOADED',
      id: 'assignee',
      items,
    })
  })

  it('should load items when condition id changes', async () => {
    const actions = machine.implementations.actions
    const send = vi.fn()
    const setContext = vi.fn()

    const items = [{ label: 'John Doe', value: 'john', id: 'john' }]
    const loadItems = vi.fn().mockResolvedValue(items)

    const conditions = [
      {
        id: 'status',
        label: 'Status',
        type: 'enum',
        items: [], // Static items for first condition
      },
      {
        id: 'assignee',
        label: 'Assignee',
        type: 'enum',
        items: loadItems,
      },
    ]

    const mockContext = {
      get: (key: string) => {
        if (key === 'activeConditions')
          // Simulate state AFTER update: ID is now 'assignee'
          return [{ key: 'c1', id: 'assignee', value: null }]
        if (key === 'items') return {}
        if (key === 'loading') return {}
        if (key === 'hash') return 'some-hash'
        return undefined
      },
      set: setContext,
    }

    // Simulate the watcher triggering checkActiveConditions
    await (actions as any).checkActiveConditions({
      context: mockContext as any,
      prop: ((key: string) => {
        if (key === 'conditions') return conditions
        return undefined
      }) as any,
      send,
    })

    expect(setContext).toHaveBeenCalledWith('loading', { assignee: true })

    // Wait for async
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(loadItems).toHaveBeenCalledWith({ id: 'assignee' })

    // Wait for async promise resolution
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(send).toHaveBeenCalledWith({
      type: 'ITEMS_LOADED',
      id: 'assignee',
      items,
    })
  })
})
