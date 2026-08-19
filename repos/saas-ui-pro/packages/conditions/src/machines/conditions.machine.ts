import { type Service, createMachine } from '@zag-js/core'
import type { NormalizeProps, PropTypes } from '@zag-js/types'

import { defaultOperators } from '../core/operators'
import type {
  Condition,
  ConditionItem,
  ConditionOperatorId,
  ConditionOperators,
  ConditionValue,
} from '../types/condition.types'

/* -----------------------------------------------------------------------------
 * Machine context
 * -----------------------------------------------------------------------------*/

export interface ConditionsProps {
  /**
   * Available conditions that can be added
   */
  conditions?: ConditionItem[]
  /**
   * Default active conditions (uncontrolled)
   */
  defaultValue?: Condition[]
  /**
   * Controlled active conditions
   */
  value?: Condition[]
  /**
   * Available operators
   */
  operators?: ConditionOperators
  /**
   * Callback when active conditions change
   */
  onChange?(conditions: Condition[]): void
}

/* -----------------------------------------------------------------------------
 * Machine state
 * -----------------------------------------------------------------------------*/

export interface MachineState {
  value: 'idle'
}

/* -----------------------------------------------------------------------------
 * Machine schema
 * -----------------------------------------------------------------------------*/

export interface ConditionsSchema {
  props: ConditionsProps
  state: 'idle'
  event: MachineEvent
  context: {
    activeConditions: Condition[]
    items: Record<string, ConditionItem[]>
    loading: Record<string, boolean>
    hash: string
  }
  computed: {
    hasActiveConditions: boolean
  }
  action: string
  guard: string
  effect: string
}

/* -----------------------------------------------------------------------------
 * Machine events
 * -----------------------------------------------------------------------------*/

export type MachineEvent =
  | {
      type: 'ADD_CONDITION'
      condition: Condition
    }
  | {
      type: 'UPDATE_CONDITION'
      key: string
      updates: Partial<{
        id: string
        value: ConditionValue
        operator: ConditionOperatorId
      }>
    }
  | {
      type: 'REMOVE_CONDITION'
      key: string
    }
  | {
      type: 'CLEAR_ALL'
    }
  | {
      type: 'ITEMS_LOADED'
      id: string
      items: ConditionItem[]
    }
  | {
      type: 'ITEMS_ERROR'
      id: string
      error: Error
    }

/* -----------------------------------------------------------------------------
 * Public API
 * -----------------------------------------------------------------------------*/

export interface UserDefinedContext extends Partial<ConditionsProps> {}

export interface MachineApi<T extends PropTypes = PropTypes> {
  /**
   * Available conditions
   */
  conditions: ConditionItem[]
  /**
   * Active conditions array
   */
  activeConditions: Condition[]
  /**
   * Whether there are any active conditions
   */
  hasActiveConditions: boolean

  /**
   * Add a new condition
   */
  addCondition(condition: Condition): string
  /**
   * Update an existing condition
   */
  updateCondition(
    key: string,
    updates: Partial<{
      id: string
      value: ConditionValue
      operator: ConditionOperatorId
    }>,
  ): void
  /**
   * Remove a condition by key
   */
  removeCondition(key: string): void
  /**
   * Clear all conditions
   */
  clearAll(): void

  /**
   * Get a condition definition by id
   */
  getCondition(id: string): ConditionItem | undefined
  /**
   * Get an active condition by key
   */
  getActiveCondition(key: string): Condition | undefined
  /**
   * Get operators for a specific type
   */
  getOperators(type?: string): ConditionOperators
  /**
   * Get options for a specific condition
   */
  getOptions(conditionId: string): ConditionItem[] | undefined
  /**
   * Check if options are loading for a specific condition
   */
  isLoading(conditionId: string): boolean
  /**
   * Load items for a specific condition on-demand
   */
  loadItems(conditionId: string): void

  /**
   * Get props for the root element
   */
  getRootProps(): T['element']
  /**
   * Get props for the list container
   */
  getListProps(): T['element']
  /**
   * Get props for a condition item
   */
  getItemProps(key: string): T['element']
  /**
   * Get props for the clear all button
   */
  getClearButtonProps(): T['button']
}

/* -----------------------------------------------------------------------------
 * Machine implementation
 * -----------------------------------------------------------------------------*/

export const machine = createMachine<ConditionsSchema>({
  props({ props }) {
    return {
      conditions: [],
      operators: defaultOperators,
      defaultConditions: [],
      ...props,
    }
  },

  context({ prop, bindable }) {
    const initialActiveConditions: Condition[] = []

    const defaultConditions = prop('defaultValue') || []
    const conditions = prop('conditions') || []

    defaultConditions.forEach((condition) => {
      const key = condition.key || `${condition.id}-${Date.now()}`
      const def = conditions.find((c) => c.id === condition.id)
      initialActiveConditions.push({
        ...condition,
        key,
        label: def?.label,
        type: def?.type,
      })
    })

    // Pre-load all static (non-async) items
    const initialItems: Record<string, ConditionItem[]> = {}
    conditions.forEach((condition) => {
      if (condition.items && Array.isArray(condition.items)) {
        initialItems[condition.id] = condition.items
      }
    })

    return {
      activeConditions: bindable(() => ({
        defaultValue: initialActiveConditions,
        value: prop('value'),
        onChange(conditions) {
          prop('onChange')?.(conditions)
        },
      })),
      items: bindable(() => ({
        defaultValue: initialItems,
      })),
      loading: bindable(() => ({
        defaultValue: {},
      })),
      hash: bindable(() => ({
        defaultValue: JSON.stringify(initialActiveConditions),
        value: JSON.stringify(prop('value')),
      })),
    }
  },

  computed: {
    hasActiveConditions({ context }) {
      const activeConditions = context.get('activeConditions')
      return activeConditions.length > 0
    },
  },

  watch({ track, action, context }) {
    track([() => context.get('hash')], () => {
      action(['notifyChange', 'checkActiveConditions'])
    })
  },
  initialState() {
    return 'idle'
  },

  // 7. Define states and transitions
  states: {
    idle: {
      on: {
        ADD_CONDITION: {
          actions: ['addCondition', 'notifyChange'],
        },
        UPDATE_CONDITION: {
          actions: ['updateCondition', 'notifyChange'],
        },
        REMOVE_CONDITION: {
          actions: ['removeCondition', 'notifyChange'],
        },
        CLEAR_ALL: {
          actions: ['clearAll', 'notifyChange'],
        },
        ITEMS_LOADED: {
          actions: ['setItems'],
        },
        ITEMS_ERROR: {
          actions: ['setError'],
        },
      },
    },
  },

  // 8. Implement actions, guards, effects
  implementations: {
    actions: {
      addCondition({ context, prop, event }) {
        if (event.type !== 'ADD_CONDITION') return

        const { condition } = event
        const activeConditions = context.get('activeConditions')
        const conditions = prop('conditions') || []

        const key = condition.key || `${condition.id}-${Date.now()}`
        const conditionDef = conditions.find((c) => c.id === condition.id)
        const operator =
          condition.operator || conditionDef?.defaultOperator || 'equals'

        // Create a new array to trigger reactivity
        const newActiveConditions = [
          ...activeConditions,
          {
            ...condition,
            key,
            operator,
            label: conditionDef?.label,
            type: conditionDef?.type,
          },
        ]

        context.set('activeConditions', newActiveConditions)
        context.set('hash', JSON.stringify(newActiveConditions))
      },

      updateCondition({ context, prop, event }) {
        if (event.type !== 'UPDATE_CONDITION') return

        const { key, updates } = event
        const activeConditions = context.get('activeConditions')
        const conditions = prop('conditions') || []

        // If ID is changing, we need to update label and type as well
        let extraUpdates = {}
        if (updates.id) {
          const def = conditions.find((c) => c.id === updates.id)
          extraUpdates = {
            label: def?.label,
            type: def?.type,
            // Reset operator if not provided, as it might be invalid for new type
            operator: updates.operator || def?.defaultOperator || 'equals',
          }
        }

        // Create a new array with the updated condition
        const newActiveConditions = activeConditions.map((c) =>
          c.key === key ? { ...c, ...updates, ...extraUpdates } : c,
        )

        context.set('activeConditions', newActiveConditions)
        context.set('hash', JSON.stringify(newActiveConditions))
      },

      removeCondition({ context, event }) {
        if (event.type !== 'REMOVE_CONDITION') return

        const activeConditions = context.get('activeConditions')

        // Create a new array without the removed condition
        const newActiveConditions = activeConditions.filter(
          (c) => c.key !== event.key,
        )

        context.set('activeConditions', newActiveConditions)
        context.set('hash', JSON.stringify(newActiveConditions))
      },

      clearAll({ context }) {
        // Create a new empty array
        context.set('activeConditions', [])
        context.set('hash', JSON.stringify([]))
      },

      notifyChange({ prop, context }) {
        const activeConditions = context.get('activeConditions')
        prop('onChange')?.(activeConditions)
      },

      checkActiveConditions({ context, prop, send }) {
        const activeConditions = context.get('activeConditions')
        const conditions = prop('conditions') || []
        const items = context.get('items')
        const loading = context.get('loading')

        // Load items for each active condition (only async items will actually load)
        activeConditions.forEach((condition) => {
          const def = conditions.find((c) => c.id === condition.id)

          // Only load async items (functions) that aren't already loaded/loading
          if (
            typeof def?.items === 'function' &&
            !items[condition.id] &&
            !loading[condition.id]
          ) {
            // Mark as loading
            const newLoading = {
              ...context.get('loading'),
              [condition.id]: true,
            }
            context.set('loading', newLoading)

            const fetchItems = async () => {
              try {
                const result = await (
                  def.items as (params: {
                    id: string
                  }) => Promise<ConditionItem[]>
                )({ id: condition.id })
                send({ type: 'ITEMS_LOADED', id: condition.id, items: result })
              } catch (error) {
                send({
                  type: 'ITEMS_ERROR',
                  id: condition.id,
                  error:
                    error instanceof Error ? error : new Error(String(error)),
                })
              }
            }
            fetchItems()
          }
        })
      },

      setItems({ context, event }) {
        if (event.type !== 'ITEMS_LOADED') return
        const { id, items } = event
        const currentItems = context.get('items')
        context.set('items', { ...currentItems, [id]: items })

        const currentLoading = context.get('loading')
        context.set('loading', { ...currentLoading, [id]: false })
      },

      setLoading({ context, event }) {
        // This action is called when we start loading
        // We need a way to trigger this.
      },

      setError({ context, event }) {
        if (event.type !== 'ITEMS_ERROR') return
        const { id } = event
        const currentLoading = context.get('loading')
        context.set('loading', { ...currentLoading, [id]: false })
      },
    },
  },
})

/* -----------------------------------------------------------------------------
 * Connect function - transforms state to API
 * -----------------------------------------------------------------------------*/

export function connect<T extends PropTypes>(
  service: Service<ConditionsSchema>,
  normalize: NormalizeProps<T>,
): MachineApi<T> {
  const { context, send, computed, prop } = service

  const conditions = prop('conditions') || []
  const operators = prop('operators') || defaultOperators
  const hasActiveConditions = computed('hasActiveConditions')
  const activeConditions = context.get('activeConditions')

  return {
    conditions,
    activeConditions,
    hasActiveConditions,

    addCondition(condition: Condition) {
      const key = condition.key || `${condition.id}-${Date.now()}`
      send({ type: 'ADD_CONDITION', condition: { ...condition, key } })
      return key
    },

    updateCondition(
      key: string,
      updates: Partial<{
        id: string
        value: ConditionValue
        operator: ConditionOperatorId
      }>,
    ) {
      send({ type: 'UPDATE_CONDITION', key, updates })
    },

    removeCondition(key: string) {
      send({ type: 'REMOVE_CONDITION', key })
    },

    clearAll() {
      send({ type: 'CLEAR_ALL' })
    },

    getCondition(id: string) {
      return conditions.find((c: ConditionItem) => c.id === id)
    },

    getActiveCondition(key: string) {
      return activeConditions.find((c) => c.key === key)
    },

    getOperators(type = 'string') {
      return operators.filter(({ types }: any) => types.includes(type as any))
    },

    getOptions(conditionId: string) {
      return context.get('items')[conditionId]
    },

    isLoading(conditionId: string) {
      return context.get('loading')[conditionId] || false
    },

    loadItems(conditionId: string) {
      const def = conditions.find((c: ConditionItem) => c.id === conditionId)
      const items = context.get('items')
      const loading = context.get('loading')

      // Only load async items (functions) that aren't already loaded/loading
      if (
        typeof def?.items === 'function' &&
        !items[conditionId] &&
        !loading[conditionId]
      ) {
        // Mark as loading
        const newLoading = { ...context.get('loading'), [conditionId]: true }
        context.set('loading', newLoading)

        const fetchItems = async () => {
          try {
            const result = await (
              def.items as (params: { id: string }) => Promise<ConditionItem[]>
            )({ id: conditionId })
            send({ type: 'ITEMS_LOADED', id: conditionId, items: result })
          } catch (error) {
            send({
              type: 'ITEMS_ERROR',
              id: conditionId,
              error: error instanceof Error ? error : new Error(String(error)),
            })
          }
        }
        fetchItems()
      }
    },

    getRootProps() {
      return normalize.element({
        'data-scope': 'conditions',
        'data-part': 'root',
      })
    },

    getListProps() {
      return normalize.element({
        'data-scope': 'conditions',
        'data-part': 'list',
        role: 'list',
        'aria-label': 'Active conditions',
      })
    },

    getItemProps(key: string) {
      return normalize.element({
        'data-scope': 'conditions',
        'data-part': 'item',
        role: 'listitem',
        'data-condition-key': key,
        key,
      })
    },

    getClearButtonProps() {
      return normalize.button({
        'data-scope': 'conditions',
        'data-part': 'clear-button',
        type: 'button' as const,
        onClick() {
          send({ type: 'CLEAR_ALL' })
        },
        disabled: !hasActiveConditions,
      })
    },
  }
}
