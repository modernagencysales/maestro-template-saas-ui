import { describe, expect, it } from 'vitest'

import type { Condition } from '#types/condition.types.ts'

import {
  fromPrismaWhere,
  toDrizzleFilter,
  toPrismaWhere,
  toPrismaWhereAnd,
  toPrismaWhereOr,
} from './converters.ts'

describe('Converters', () => {
  describe('toPrismaWhere', () => {
    it('should convert simple equality condition', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'equals', value: 'active' },
      ]

      const result = toPrismaWhere(conditions)

      expect(result).toEqual({
        status: { equals: 'active' },
      })
    })

    it('should convert multiple conditions', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'equals', value: 'active' },
        { id: 'age', operator: 'gte', value: 18 },
        { id: 'name', operator: 'contains', value: 'John' },
      ]

      const result = toPrismaWhere(conditions)

      expect(result).toEqual({
        status: { equals: 'active' },
        age: { gte: 18 },
        name: { contains: 'John' },
      })
    })

    it('should handle array operators', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'in', value: ['active', 'pending'] },
        { id: 'role', operator: 'notIn', value: ['admin'] },
      ]

      const result = toPrismaWhere(conditions)

      expect(result).toEqual({
        status: { in: ['active', 'pending'] },
        role: { notIn: ['admin'] },
      })
    })

    it('should handle comparison operators', () => {
      const conditions: Condition[] = [
        { id: 'age', operator: 'gt', value: 18 },
        { id: 'score', operator: 'lte', value: 100 },
      ]

      const result = toPrismaWhere(conditions)

      expect(result).toEqual({
        age: { gt: 18 },
        score: { lte: 100 },
      })
    })

    it('should handle text search operators', () => {
      const conditions: Condition[] = [
        { id: 'name', operator: 'contains', value: 'John' },
        { id: 'email', operator: 'startsWith', value: 'admin' },
        { id: 'phone', operator: 'endsWith', value: '123' },
      ]

      const result = toPrismaWhere(conditions)

      expect(result).toEqual({
        name: { contains: 'John' },
        email: { startsWith: 'admin' },
        phone: { endsWith: '123' },
      })
    })

    it('should handle empty conditions array', () => {
      const result = toPrismaWhere([])
      expect(result).toEqual({})
    })
  })

  describe('toPrismaWhereAnd', () => {
    it('should wrap conditions in AND array', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'equals', value: 'active' },
        { id: 'age', operator: 'gte', value: 18 },
      ]

      const result = toPrismaWhereAnd(conditions)

      expect(result).toEqual({
        AND: [{ status: { equals: 'active' } }, { age: { gte: 18 } }],
      })
    })
  })

  describe('toPrismaWhereOr', () => {
    it('should wrap conditions in OR array', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'equals', value: 'active' },
        { id: 'status', operator: 'equals', value: 'pending' },
      ]

      const result = toPrismaWhereOr(conditions)

      expect(result).toEqual({
        OR: [
          { status: { equals: 'active' } },
          { status: { equals: 'pending' } },
        ],
      })
    })
  })

  describe('toDrizzleFilter', () => {
    it('should convert equality conditions', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'equals', value: 'active' },
      ]

      const result = toDrizzleFilter(conditions)

      expect(result).toEqual([
        { operator: 'eq', field: 'status', value: 'active' },
      ])
    })

    it('should convert comparison operators', () => {
      const conditions: Condition[] = [
        { id: 'age', operator: 'gt', value: 18 },
        { id: 'score', operator: 'gte', value: 50 },
        { id: 'price', operator: 'lt', value: 100 },
        { id: 'rating', operator: 'lte', value: 5 },
      ]

      const result = toDrizzleFilter(conditions)

      expect(result).toEqual([
        { operator: 'gt', field: 'age', value: 18 },
        { operator: 'gte', field: 'score', value: 50 },
        { operator: 'lt', field: 'price', value: 100 },
        { operator: 'lte', field: 'rating', value: 5 },
      ])
    })

    it('should convert contains to LIKE with wildcards', () => {
      const conditions: Condition[] = [
        { id: 'name', operator: 'contains', value: 'John' },
      ]

      const result = toDrizzleFilter(conditions)

      expect(result).toEqual([
        { operator: 'like', field: 'name', value: '%John%' },
      ])
    })

    it('should convert startsWith to LIKE with trailing wildcard', () => {
      const conditions: Condition[] = [
        { id: 'email', operator: 'startsWith', value: 'admin' },
      ]

      const result = toDrizzleFilter(conditions)

      expect(result).toEqual([
        { operator: 'like', field: 'email', value: 'admin%' },
      ])
    })

    it('should convert endsWith to LIKE with leading wildcard', () => {
      const conditions: Condition[] = [
        { id: 'phone', operator: 'endsWith', value: '123' },
      ]

      const result = toDrizzleFilter(conditions)

      expect(result).toEqual([
        { operator: 'like', field: 'phone', value: '%123' },
      ])
    })

    it('should convert array operators', () => {
      const conditions: Condition[] = [
        { id: 'status', operator: 'in', value: ['active', 'pending'] },
        { id: 'role', operator: 'notIn', value: ['admin'] },
      ]

      const result = toDrizzleFilter(conditions)

      expect(result).toEqual([
        {
          operator: 'inArray',
          field: 'status',
          value: ['active', 'pending'],
        },
        { operator: 'notInArray', field: 'role', value: ['admin'] },
      ])
    })

    it('should handle empty conditions array', () => {
      const result = toDrizzleFilter([])
      expect(result).toEqual([])
    })
  })

  describe('fromPrismaWhere', () => {
    it('should convert simple Prisma where clause', () => {
      const where = {
        status: { equals: 'active' },
      }

      const result = fromPrismaWhere(where)

      expect(result).toEqual([
        { id: 'status', operator: 'equals', value: 'active' },
      ])
    })

    it('should convert direct equality', () => {
      const where = {
        status: 'active',
      }

      const result = fromPrismaWhere(where)

      expect(result).toEqual([
        { id: 'status', operator: 'equals', value: 'active' },
      ])
    })

    it('should convert null checks', () => {
      const where = {
        deletedAt: null,
      }

      const result = fromPrismaWhere(where)

      expect(result).toEqual([
        { id: 'deletedAt', operator: 'isNull', value: null },
      ])
    })

    it('should convert isNotNull (not: null)', () => {
      const where = {
        email: { not: null },
      }

      const result = fromPrismaWhere(where)

      expect(result).toEqual([{ id: 'email', operator: 'isNotNull' }])
    })

    it('should convert multiple conditions', () => {
      const where = {
        status: { equals: 'active' },
        age: { gte: 18 },
        name: { contains: 'John' },
      }

      const result = fromPrismaWhere(where)

      expect(result).toEqual([
        { id: 'status', operator: 'equals', value: 'active' },
        { id: 'age', operator: 'gte', value: 18 },
        { id: 'name', operator: 'contains', value: 'John' },
      ])
    })

    it('should handle empty where clause', () => {
      const result = fromPrismaWhere({})
      expect(result).toEqual([])
    })

    it('should handle array operators', () => {
      const where = {
        status: { in: ['active', 'pending'] },
        role: { notIn: ['admin'] },
      }

      const result = fromPrismaWhere(where)

      expect(result).toEqual([
        { id: 'status', operator: 'in', value: ['active', 'pending'] },
        { id: 'role', operator: 'notIn', value: ['admin'] },
      ])
    })
  })

  describe('Round-trip conversion', () => {
    it('should maintain data through toPrismaWhere -> fromPrismaWhere', () => {
      const originalConditions: Condition[] = [
        { id: 'status', operator: 'equals', value: 'active' },
        { id: 'age', operator: 'gte', value: 18 },
        { id: 'name', operator: 'contains', value: 'John' },
      ]

      const prismaWhere = toPrismaWhere(originalConditions)
      const convertedBack = fromPrismaWhere(prismaWhere)

      expect(convertedBack).toEqual(originalConditions)
    })
  })
})
