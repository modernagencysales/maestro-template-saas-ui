import { createContext, useContext } from 'react'

import type { ConditionItem } from '#types/condition.types'

import { useConditions } from './use-conditions.ts'

type ConditionsContextValue = ReturnType<typeof useConditions>

const ConditionsContext = createContext<ConditionsContextValue | null>(null)

export interface ConditionsProviderProps<
  TConditions extends readonly ConditionItem[],
> {
  value: ReturnType<typeof useConditions<TConditions>>
  children: React.ReactNode
}

export function ConditionsProvider<
  TConditions extends readonly ConditionItem[],
>({ children, ...props }: ConditionsProviderProps<TConditions>) {
  return (
    <ConditionsContext.Provider value={props.value}>
      {children}
    </ConditionsContext.Provider>
  )
}

export function useConditionsContext() {
  const context = useContext(ConditionsContext)
  if (!context) {
    throw new Error(
      'useConditionsContext must be used within a ConditionsProvider',
    )
  }
  return context
}
