import type {
  ConditionItem,
  ConditionOperators,
} from '../types/condition.types'
import { defaultOperators } from './operators'

export function defineConditions<
  const TConditions extends readonly ConditionItem[],
  const TOperators extends ConditionOperators = typeof defaultOperators,
>(config: { conditions: TConditions; operators?: TOperators }) {
  return config
}
