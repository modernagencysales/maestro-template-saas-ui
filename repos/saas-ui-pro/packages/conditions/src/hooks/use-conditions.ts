'use client'

import { normalizeProps, useMachine } from '@zag-js/react'
import type { PropTypes } from '@zag-js/types'

import type { Condition, ConditionItem } from '#types/condition.types'

import {
  type ConditionsProps,
  type MachineApi,
  type UserDefinedContext,
  connect,
  machine,
} from '../machines/conditions.machine'

export interface UseConditionsProps<
  TConditions extends readonly ConditionItem[] = ConditionItem[],
> extends Omit<
    ConditionsProps,
    'conditions' | 'onChange' | 'defaultValue' | 'value'
  > {
  conditions: TConditions
  defaultValue?: Condition<TConditions[number]['id']>[]
  value?: Condition<TConditions[number]['id']>[]
  onChange?: (conditions: Condition<TConditions[number]['id']>[]) => void
}

export interface UseConditionsReturn extends MachineApi {}

export function useConditions<
  TConditions extends readonly ConditionItem[] = ConditionItem[],
>(props: UseConditionsProps<TConditions>) {
  const { conditions, defaultValue, value, onChange, ...rest } = props

  const context: UserDefinedContext = {
    conditions: conditions as any,
    defaultValue: defaultValue as any,
    value: value as any,
    onChange: onChange as any,
    ...rest,
  }

  const service = useMachine(machine, context)

  const api = connect(service, normalizeProps)

  return {
    ...api,
    getOptions: api.getOptions,
    isLoading: api.isLoading,
    loadItems: api.loadItems,
    addCondition: api.addCondition as (
      condition: Condition<TConditions[number]['id']>,
    ) => void,
    activeConditions: api.activeConditions as Condition<
      TConditions[number]['id']
    >[],
  }
}
