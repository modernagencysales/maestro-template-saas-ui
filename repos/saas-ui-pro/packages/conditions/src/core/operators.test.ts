import { describe, expect, it } from 'vitest'

import { defaultOperators, getOperatorsByType } from './operators'

describe('Operators', () => {
  describe('defaultOperators', () => {
    it('should export 15 default operators', () => {
      expect(defaultOperators).toHaveLength(15)
    })

    it('should have unique operator IDs', () => {
      const ids = defaultOperators.map((op) => op.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Equality operators', () => {
    it('equals - should compare values for equality', () => {
      const op = defaultOperators.find((o) => o.id === 'equals')!
      expect(op.comparator('active', 'active')).toBe(true)
      expect(op.comparator('active', 'inactive')).toBe(false)
      expect(op.comparator(42, 42)).toBe(true)
      expect(op.comparator(42, 43)).toBe(false)
    })

    it('not - should compare values for inequality', () => {
      const op = defaultOperators.find((o) => o.id === 'not')!
      expect(op.comparator('active', 'inactive')).toBe(true)
      expect(op.comparator('active', 'active')).toBe(false)
    })
  })

  describe('Comparison operators', () => {
    it('gt - should compare greater than', () => {
      const op = defaultOperators.find((o) => o.id === 'gt')!
      expect(op.comparator(10, 5)).toBe(true)
      expect(op.comparator(5, 10)).toBe(false)
      expect(op.comparator(5, 5)).toBe(false)
    })

    it('gte - should compare greater than or equal', () => {
      const op = defaultOperators.find((o) => o.id === 'gte')!
      expect(op.comparator(10, 5)).toBe(true)
      expect(op.comparator(5, 5)).toBe(true)
      expect(op.comparator(3, 5)).toBe(false)
    })

    it('lt - should compare less than', () => {
      const op = defaultOperators.find((o) => o.id === 'lt')!
      expect(op.comparator(5, 10)).toBe(true)
      expect(op.comparator(10, 5)).toBe(false)
      expect(op.comparator(5, 5)).toBe(false)
    })

    it('lte - should compare less than or equal', () => {
      const op = defaultOperators.find((o) => o.id === 'lte')!
      expect(op.comparator(5, 10)).toBe(true)
      expect(op.comparator(5, 5)).toBe(true)
      expect(op.comparator(10, 5)).toBe(false)
    })

    it('should handle date comparisons', () => {
      const gt = defaultOperators.find((o) => o.id === 'gt')!
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-02')

      expect(gt.comparator(date2, date1)).toBe(true)
      expect(gt.comparator(date1, date2)).toBe(false)
    })

    it('should handle date string comparisons', () => {
      const gt = defaultOperators.find((o) => o.id === 'gt')!
      expect(gt.comparator('2024-01-02', '2024-01-01')).toBe(true)
      expect(gt.comparator('2024-01-01', '2024-01-02')).toBe(false)
    })

    it('should return false for undefined values', () => {
      const gt = defaultOperators.find((o) => o.id === 'gt')!
      expect(gt.comparator(undefined, 5)).toBe(false)
    })
  })

  describe('Text search operators', () => {
    it('contains - should check if text contains substring (case-insensitive)', () => {
      const op = defaultOperators.find((o) => o.id === 'contains')!
      expect(op.comparator('Hello World', 'world')).toBe(true)
      expect(op.comparator('Hello World', 'HELLO')).toBe(true)
      expect(op.comparator('Hello World', 'xyz')).toBe(false)
      expect(op.comparator('', 'test')).toBe(false)
      expect(op.comparator('test', '')).toBe(false)
    })

    it('startsWith - should check if text starts with substring (case-insensitive)', () => {
      const op = defaultOperators.find((o) => o.id === 'startsWith')!
      expect(op.comparator('Hello World', 'hello')).toBe(true)
      expect(op.comparator('Hello World', 'HELLO')).toBe(true)
      expect(op.comparator('Hello World', 'world')).toBe(false)
    })

    it('endsWith - should check if text ends with substring (case-insensitive)', () => {
      const op = defaultOperators.find((o) => o.id === 'endsWith')!
      expect(op.comparator('Hello World', 'world')).toBe(true)
      expect(op.comparator('Hello World', 'WORLD')).toBe(true)
      expect(op.comparator('Hello World', 'hello')).toBe(false)
    })
  })

  describe('List/Array operators', () => {
    it('in - should check if value is in array', () => {
      const op = defaultOperators.find((o) => o.id === 'in')!
      expect(op.comparator('active', ['active', 'pending'])).toBe(true)
      expect(op.comparator('inactive', ['active', 'pending'])).toBe(false)
      expect(op.comparator(2, [1, 2, 3])).toBe(true)
    })

    it('notIn - should check if value is not in array', () => {
      const op = defaultOperators.find((o) => o.id === 'notIn')!
      expect(op.comparator('inactive', ['active', 'pending'])).toBe(true)
      expect(op.comparator('active', ['active', 'pending'])).toBe(false)
    })

    it('some - should check if array has some of the values', () => {
      const op = defaultOperators.find((o) => o.id === 'some')!
      expect(op.comparator(['red', 'blue'], ['blue'])).toBe(true)
      expect(op.comparator(['red', 'blue'], ['blue', 'green'])).toBe(true)
      expect(op.comparator(['red', 'blue'], ['green', 'yellow'])).toBe(false)
    })

    it('hasEvery - should check if array has all of the values', () => {
      const op = defaultOperators.find((o) => o.id === 'every')!
      expect(op.comparator(['red', 'blue', 'green'], ['blue', 'red'])).toBe(
        true,
      )
      expect(op.comparator(['red', 'blue'], ['blue', 'green'])).toBe(false)
    })

    it('should handle non-array inputs gracefully', () => {
      const hasSome = defaultOperators.find((o) => o.id === 'some')!
      expect(hasSome.comparator('not-array', ['test'])).toBe(false)
      expect(hasSome.comparator(['test'], 'not-array')).toBe(false)
    })
  })

  describe('getOperatorsByType', () => {
    it('should return operators for string type', () => {
      const ops = getOperatorsByType('string')
      const ids = ops.map((o) => o.id)
      expect(ids).toContain('equals')
      expect(ids).toContain('not')
      expect(ids).toContain('contains')
      expect(ids).toContain('startsWith')
      expect(ids).toContain('endsWith')
    })

    it('should return operators for number type', () => {
      const ops = getOperatorsByType('number')
      const ids = ops.map((o) => o.id)
      expect(ids).toContain('equals')
      expect(ids).toContain('gt')
      expect(ids).toContain('gte')
      expect(ids).toContain('lt')
      expect(ids).toContain('lte')
      expect(ids).toContain('in')
    })

    it('should return operators for enum type', () => {
      const ops = getOperatorsByType('enum')
      const ids = ops.map((o) => o.id)
      expect(ids).toContain('equals')
      expect(ids).toContain('not')
      expect(ids).toContain('in')
      expect(ids).toContain('notIn')
      expect(ids).toContain('some')
      expect(ids).toContain('every')
    })

    it('should return operators for date type', () => {
      const ops = getOperatorsByType('date')
      const ids = ops.map((o) => o.id)
      expect(ids).toContain('equals')
      expect(ids).toContain('gt')
      expect(ids).toContain('gte')
      expect(ids).toContain('lt')
      expect(ids).toContain('lte')
    })

    it('should use default operators if none provided', () => {
      const ops = getOperatorsByType('string')
      expect(ops.length).toBeGreaterThan(0)
    })

    it('should accept custom operators', () => {
      const customOps = [
        {
          id: 'custom' as any,
          label: 'Custom',
          types: ['string' as any],
          comparator: () => true,
        },
      ]
      const ops = getOperatorsByType('string', customOps)
      expect(ops).toHaveLength(1)
      expect(ops[0].id).toBe('custom')
    })
  })
})
