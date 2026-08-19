import type {
  ConditionOperator,
  ConditionOperatorId,
  ConditionOperators,
  ConditionType,
} from '../types/condition.types'

export type { ConditionOperator, ConditionOperatorId, ConditionType }

export const defaultOperators: ConditionOperators = [
  // Equality operators
  {
    id: 'equals',
    label: 'is',
    types: ['enum', 'string', 'number', 'boolean', 'date'],
    comparator(value: any, conditionValue: any) {
      return value === conditionValue
    },
  },
  {
    id: 'not',
    label: 'is not',
    types: ['enum', 'string', 'number', 'boolean', 'date'],
    comparator(value: any, conditionValue: any) {
      return value !== conditionValue
    },
  },

  // Comparison operators (numbers and dates)
  {
    id: 'gt',
    label: 'greater than',
    types: ['number', 'date', 'datetime'],
    comparator(
      value: number | Date | undefined,
      conditionValue: number | Date,
    ) {
      if (value === undefined) return false

      // Handle date strings
      if (typeof value === 'string') value = new Date(value)
      if (typeof conditionValue === 'string')
        conditionValue = new Date(conditionValue)

      return value > conditionValue
    },
  },
  {
    id: 'gte',
    label: 'greater than or equal',
    types: ['number', 'date', 'datetime'],
    comparator(
      value: number | Date | undefined,
      conditionValue: number | Date,
    ) {
      if (value === undefined) return false

      // Handle date strings
      if (typeof value === 'string') value = new Date(value)
      if (typeof conditionValue === 'string')
        conditionValue = new Date(conditionValue)

      return value >= conditionValue
    },
  },
  {
    id: 'lt',
    label: 'less than',
    types: ['number', 'date', 'datetime'],
    comparator(
      value: number | Date | undefined,
      conditionValue: number | Date,
    ) {
      if (value === undefined) return false

      // Handle date strings
      if (typeof value === 'string') value = new Date(value)
      if (typeof conditionValue === 'string')
        conditionValue = new Date(conditionValue)

      return value < conditionValue
    },
  },
  {
    id: 'lte',
    label: 'less than or equal',
    types: ['number', 'date', 'datetime'],
    comparator(
      value: number | Date | undefined,
      conditionValue: number | Date,
    ) {
      if (value === undefined) return false

      // Handle date strings
      if (typeof value === 'string') value = new Date(value)
      if (typeof conditionValue === 'string')
        conditionValue = new Date(conditionValue)

      return value <= conditionValue
    },
  },

  // Text search operators
  {
    id: 'contains',
    label: 'contains',
    types: ['string'],
    comparator(value: string | undefined, conditionValue: string | undefined) {
      if (!value || !conditionValue) return false
      return value.toLowerCase().includes(conditionValue.toLowerCase())
    },
  },
  {
    id: 'startsWith',
    label: 'starts with',
    types: ['string'],
    comparator(value: string | undefined, conditionValue: string | undefined) {
      if (!value || !conditionValue) return false
      return value.toLowerCase().startsWith(conditionValue.toLowerCase())
    },
  },
  {
    id: 'endsWith',
    label: 'ends with',
    types: ['string'],
    comparator(value: string | undefined, conditionValue: string | undefined) {
      if (!value || !conditionValue) return false
      return value.toLowerCase().endsWith(conditionValue.toLowerCase())
    },
  },

  // List/Array operators
  {
    id: 'in',
    label: 'is any of',
    types: ['enum', 'string', 'number'],
    comparator(value: any, conditionValue: any[]) {
      if (!Array.isArray(conditionValue)) return false
      return conditionValue.includes(value)
    },
  },
  {
    id: 'notIn',
    label: 'is none of',
    types: ['enum', 'string', 'number'],
    comparator(value: any, conditionValue: any[]) {
      if (!Array.isArray(conditionValue)) return false
      return !conditionValue.includes(value)
    },
  },
  {
    id: 'some',
    label: 'has some of',
    types: ['enum'],
    comparator(value: any[], conditionValue: any[]) {
      if (!Array.isArray(value) || !Array.isArray(conditionValue)) return false
      return conditionValue.some((item) => value.includes(item))
    },
  },
  {
    id: 'every',
    label: 'has all of',
    types: ['enum'],
    comparator(value: any[], conditionValue: any[]) {
      if (!Array.isArray(value) || !Array.isArray(conditionValue)) return false
      return conditionValue.every((item) => value.includes(item))
    },
  },
]

/**
 * Create custom operators with type safety
 */
export const createOperators = <Operator extends string, Type extends string>(
  operators: ConditionOperators<Operator, Type>,
) => {
  return operators
}

/**
 * Get operators by type
 */
export const getOperatorsByType = (
  type: ConditionType = 'string',
  operators: ConditionOperators = defaultOperators,
) => {
  return operators.filter(({ types }) => types.includes(type as any))
}
