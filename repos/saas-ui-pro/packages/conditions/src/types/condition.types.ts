// Aligned with Prisma filter operators
// https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#filter-conditions-and-operators
export type ConditionOperatorId =
  // Equality
  | 'equals'
  | 'not'
  // Comparison
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  // Text search
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  // Lists/Arrays
  | 'in'
  | 'notIn'
  | 'some'
  | 'every'

export type ConditionType =
  | 'enum'
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'

export type ConditionValue =
  | string
  | string[]
  | number
  | boolean
  | Date
  | null
  | undefined

export interface ConditionOperator<
  Operator extends string = ConditionOperatorId,
  Type extends string = ConditionType,
> {
  id: Operator
  label: string
  types: Type[]
  comparator(value: unknown, conditionValue: unknown): boolean
}

export type ConditionOperators<
  Operator extends string = ConditionOperatorId,
  Type extends string = ConditionType,
> = ConditionOperator<Operator, Type>[]

export interface AsyncConditionItemDetails {
  query?: string
  id: string
  value?: ConditionValue
}

export interface ConditionItem<Id extends string = string> {
  /**
   * The condition id
   */
  id: Id
  /**
   * The condition label
   *
   * e.g. "Contact is lead"
   */
  label?: string
  /**
   * The active condition label
   *
   * e.g. "Contact"
   */
  activeLabel?: string
  /**
   * Icon displayed before the label
   */
  icon?: React.ReactElement
  /**
   * The condition type
   */
  type?: ConditionType
  /**
   * The available items for this condition
   */
  items?: ConditionItems
  /**
   * Enable multiple select if true
   */
  multiple?: boolean
  /**
   * The condition value
   */
  value?: ConditionValue
  /**
   * The available operators for this condition
   */
  operators?: ConditionOperatorId[]
  /**
   * The default operator
   */
  defaultOperator?: ConditionOperatorId
  /**
   * Disable the item
   */
  disabled?: boolean
}

export type ConditionItems<Id extends string = string> =
  | readonly ConditionItem<Id>[]
  | ((
      details: AsyncConditionItemDetails,
    ) => Array<ConditionItem<Id>> | Promise<Array<ConditionItem<Id>>>)

export interface Condition<Id extends string = string> {
  key?: string
  id: Id
  value?: ConditionValue
  operator?: ConditionOperatorId
  type?: ConditionType
  label?: string
}

// Machine Context Types

export interface ConditionsMachineContext<
  Operator extends string = ConditionOperatorId,
  Type extends string = ConditionType,
  Id extends string = string,
> {
  /**
   * Available conditions that can be added
   */
  conditions: ConditionItem<Id>[]
  /**
   * Currently active conditions (key -> condition context)
   */
  activeConditions: Map<string, Condition<Id>>
  /**
   * Available operators
   */
  operators: ConditionOperators<Operator, Type>
}

export interface ConditionValueMachineContext {
  /**
   * Condition ID this value selector is for
   */
  id: string
  /**
   * Current value
   */
  value: ConditionValue
  /**
   * Available items (can be async function)
   */
  items: ConditionItems
  /**
   * Items that have been loaded (cached)
   */
  loadedItems: ConditionItem[]
  /**
   * Current search query
   */
  query: string
  /**
   * Whether multiple values can be selected
   */
  multiple: boolean
  /**
   * Whether the value selector is open
   */
  open: boolean
  /**
   * Whether items are currently loading
   */
  isLoading: boolean
  /**
   * Whether items have been fetched at least once
   */
  isFetched: boolean
  /**
   * Currently highlighted item ID (for keyboard navigation)
   */
  highlightedId?: string
  /**
   * Error state if loading fails
   */
  error?: Error
}

// Event Types

export interface ConditionChangeEvent {
  id: string
  value: ConditionValue
  operator: ConditionOperatorId
}

export interface ConditionListChangeEvent {
  conditions: Condition[]
}
