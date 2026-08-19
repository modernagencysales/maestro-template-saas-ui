// Hooks
export { useCondition } from './hooks/use-condition'
export type {
  UseConditionProps,
  UseConditionReturn,
} from './hooks/use-condition'

export { useConditions } from './hooks/use-conditions'
export type {
  UseConditionsProps,
  UseConditionsReturn,
} from './hooks/use-conditions'
export {
  ConditionsProvider,
  useConditionsContext,
} from './hooks/use-conditions-context'
export type { ConditionsProviderProps } from './hooks/use-conditions-context'

export { useConditionValue } from './hooks/use-condition-value'
export type {
  UseConditionValueProps,
  UseConditionValueReturn,
} from './hooks/use-condition-value'

// Types
export type {
  Condition,
  ConditionItem,
  ConditionItems,
  ConditionValue,
  ConditionType,
  ConditionOperator,
  ConditionOperatorId,
  ConditionOperators,
  AsyncConditionItemDetails,
  ConditionChangeEvent,
  ConditionListChangeEvent,
} from './types/condition.types'

// Operators
export {
  defaultOperators,
  createOperators,
  getOperatorsByType,
} from './core/operators'

// Converters (for backend integration)
export {
  toPrismaWhere,
  toPrismaWhereAnd,
  toPrismaWhereOr,
  toDrizzleFilter,
  fromPrismaWhere,
} from './core/converters'
export type { PrismaWhereInput } from './core/converters'

// Machine types (for advanced usage)
export type { MachineApi as ConditionsMachineApi } from './machines/conditions.machine'
export type { MachineApi as ConditionValueMachineApi } from './machines/condition-value.machine'
