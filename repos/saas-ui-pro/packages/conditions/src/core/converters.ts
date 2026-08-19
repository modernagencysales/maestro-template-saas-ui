import type {
  Condition,
  ConditionOperatorId,
  ConditionValue,
} from '../types/condition.types'

/**
 * Convert UI conditions to Prisma where clause format
 * @see https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#filter-conditions-and-operators
 *
 * @example
 * const conditions = [
 *   { id: 'status', operator: 'equals', value: 'active' },
 *   { id: 'age', operator: 'gte', value: 18 },
 * ]
 *
 * toPrismaWhere(conditions)
 * // Returns:
 * // {
 * //   status: { equals: 'active' },
 * //   age: { gte: 18 }
 * // }
 */
export function toPrismaWhere(conditions: Condition[]): Record<string, any> {
  const where: Record<string, any> = {}

  for (const condition of conditions) {
    const { id, operator = 'equals', value } = condition

    // For all other operators, map to Prisma format
    where[id] = { [operator]: value }
  }

  return where
}

/**
 * Convert UI conditions to Drizzle filter format
 * Note: This returns a plain object representation.
 * You'll need to import operators from 'drizzle-orm' in your backend code.
 *
 * @example
 * const conditions = [
 *   { id: 'status', operator: 'equals', value: 'active' },
 *   { id: 'age', operator: 'gte', value: 18 },
 * ]
 *
 * toDrizzleFilter(conditions)
 * // Returns:
 * // [
 * //   { operator: 'eq', field: 'status', value: 'active' },
 * //   { operator: 'gte', field: 'age', value: 18 }
 * // ]
 *
 * // Then in your backend:
 * import { eq, gte, and } from 'drizzle-orm'
 * const filters = toDrizzleFilter(conditions)
 * where(and(
 *   eq(schema.status, 'active'),
 *   gte(schema.age, 18)
 * ))
 */
export function toDrizzleFilter(
  conditions: Condition[],
): Array<{ operator: string; field: string; value?: any }> {
  const operatorMap: Record<ConditionOperatorId, string> = {
    equals: 'eq',
    not: 'ne',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    contains: 'like',
    startsWith: 'like',
    endsWith: 'like',
    in: 'inArray',
    notIn: 'notInArray',
    some: 'arrayContains',
    every: 'arrayContained',
  }

  return conditions.map((condition) => {
    const { id, operator = 'equals', value } = condition
    const drizzleOp = operatorMap[operator] || operator

    // Handle special cases for LIKE operators
    let drizzleValue = value
    if (operator === 'contains') {
      drizzleValue = `%${value}%`
    } else if (operator === 'startsWith') {
      drizzleValue = `${value}%`
    } else if (operator === 'endsWith') {
      drizzleValue = `%${value}`
    }

    return {
      operator: drizzleOp,
      field: id,
      value: drizzleValue,
    }
  })
}

/**
 * Convert Prisma where clause back to UI conditions
 * Useful for loading saved filters
 */
export function fromPrismaWhere(where: Record<string, any>): Condition[] {
  const conditions: Condition[] = []

  for (const [id, filterValue] of Object.entries(where)) {
    // Handle direct equality: { status: 'active' }
    if (typeof filterValue !== 'object' || filterValue === null) {
      conditions.push({
        id,
        operator: 'equals',
        value: filterValue,
      })
      continue
    }

    // Handle operator objects: { status: { equals: 'active' } }
    for (const [operator, value] of Object.entries(filterValue)) {
      conditions.push({
        id,
        operator: operator as ConditionOperatorId,
        value: value as ConditionValue,
      })
    }
  }

  return conditions
}

/**
 * Combine multiple conditions with AND logic for Prisma
 */
export function toPrismaWhereAnd(conditions: Condition[]): { AND: any[] } {
  return {
    AND: conditions.map((c) => toPrismaWhere([c])),
  }
}

/**
 * Combine multiple conditions with OR logic for Prisma
 */
export function toPrismaWhereOr(conditions: Condition[]): { OR: any[] } {
  return {
    OR: conditions.map((c) => toPrismaWhere([c])),
  }
}

/**
 * Type-safe Prisma where clause builder
 * Use this in your backend code with actual Prisma types
 */
export type PrismaWhereInput<T = any> = {
  [K in keyof T]?: T[K] | { [operator: string]: any }
}
