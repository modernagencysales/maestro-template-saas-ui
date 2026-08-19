import { useState } from 'react'

import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import { defineConditions } from '../core/define-conditions'
import type { Condition, ConditionItem } from '../types/condition.types'
import { useConditions } from './use-conditions'

const mockConditions = defineConditions({
  conditions: [
    { id: 'status', label: 'Status', type: 'enum', defaultOperator: 'equals' },
    { id: 'age', label: 'Age', type: 'number', defaultOperator: 'gte' },
    { id: 'name', label: 'Name', type: 'string', defaultOperator: 'contains' },
  ] as const,
}).conditions

type MockConditionId = (typeof mockConditions)[number]['id']

function TestComponent({ ...props }: any) {
  const api = useConditions(props)

  return (
    <div data-testid="condition-list">
      <div data-testid="has-active">{String(api.hasActiveConditions)}</div>
      <div data-testid="active-count">{api.activeConditions.length}</div>
      <div data-testid="conditions-count">{api.conditions.length}</div>

      {/* Display active conditions */}
      <div data-testid="active-list">
        {api.activeConditions.map((condition) => (
          <div key={condition.key} data-testid={`active-${condition.key}`}>
            {condition.id}:{String(condition.value)}:{condition.operator}
          </div>
        ))}
      </div>

      {/* Add condition button */}
      <button
        data-testid="add-status"
        onClick={() => api.addCondition({ id: 'status', value: 'active' })}
      >
        Add Status
      </button>

      <button
        data-testid="add-age"
        onClick={() => api.addCondition({ id: 'age', value: 25 })}
      >
        Add Age
      </button>

      {/* Update first condition button */}
      {api.activeConditions.length > 0 && (
        <button
          data-testid="update-first"
          onClick={() =>
            api.updateCondition(api.activeConditions[0].key!, {
              value: 'updated',
            })
          }
        >
          Update First
        </button>
      )}

      {/* Remove first condition button */}
      {api.activeConditions.length > 0 && (
        <button
          data-testid="remove-first"
          onClick={() => api.removeCondition(api.activeConditions[0].key!)}
        >
          Remove First
        </button>
      )}

      {/* Clear all button */}
      <button data-testid="clear-all" onClick={() => api.clearAll()}>
        Clear All
      </button>

      {/* Test getCondition */}
      <div data-testid="get-status">
        {api.getCondition('status')?.label ?? 'not-found'}
      </div>

      {/* Test getOperators */}
      <div data-testid="string-operators">
        {api.getOperators('string').length}
      </div>
      <div data-testid="number-operators">
        {api.getOperators('number').length}
      </div>
    </div>
  )
}

let currentRoot: Root | null = null
let currentContainer: HTMLElement | null = null

function cleanup() {
  if (currentRoot) {
    currentRoot.unmount()
    currentRoot = null
  }
  if (currentContainer && document.body.contains(currentContainer)) {
    document.body.removeChild(currentContainer)
    currentContainer = null
  }
}

function render(component: React.ReactElement) {
  // Clean up any previous render
  cleanup()

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)

  currentRoot = root
  currentContainer = container
}

afterEach(() => {
  cleanup()
})

test('should initialize with empty active conditions', async () => {
  render(<TestComponent conditions={mockConditions} />)

  await expect
    .element(page.getByTestId('has-active'))
    .toHaveTextContent('false')
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('0')
  await expect
    .element(page.getByTestId('conditions-count'))
    .toHaveTextContent('3')
})

test('should initialize with default conditions', async () => {
  const defaultConditions: Condition<MockConditionId>[] = [
    { id: 'status', value: 'active', operator: 'equals' },
    { id: 'age', value: 18, operator: 'gte' },
  ]

  render(
    <TestComponent
      conditions={mockConditions}
      defaultConditions={defaultConditions}
    />,
  )

  await expect.element(page.getByTestId('has-active')).toHaveTextContent('true')
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('2')
})

test('should add conditions', async () => {
  render(<TestComponent conditions={mockConditions} />)

  // Initially no active conditions
  await expect
    .element(page.getByTestId('has-active'))
    .toHaveTextContent('false')
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('0')

  // Add status condition
  await page.getByTestId('add-status').click()

  await expect.element(page.getByTestId('has-active')).toHaveTextContent('true')
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('1')

  // Add age condition
  await page.getByTestId('add-age').click()

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('2')
})

test('should update conditions', async () => {
  const defaultConditions: Condition<MockConditionId>[] = [
    { id: 'status', value: 'active', operator: 'equals' },
  ]

  render(
    <TestComponent
      conditions={mockConditions}
      defaultConditions={defaultConditions}
    />,
  )

  // Verify initial value
  const activeList = page.getByTestId('active-list')
  await expect.element(activeList).toContainHTML('status:active:equals')

  // Update the condition
  await page.getByTestId('update-first').click()

  await expect.element(activeList).toContainHTML('status:updated:equals')
})

test('should remove conditions', async () => {
  const defaultConditions: Condition<MockConditionId>[] = [
    { id: 'status', value: 'active', operator: 'equals' },
    { id: 'age', value: 25, operator: 'gte' },
  ]

  render(
    <TestComponent
      conditions={mockConditions}
      defaultConditions={defaultConditions}
    />,
  )

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('2')

  // Remove first condition
  await page.getByTestId('remove-first').click()

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('1')
  await expect.element(page.getByTestId('has-active')).toHaveTextContent('true')
})

test('should clear all conditions', async () => {
  const defaultConditions: Condition<MockConditionId>[] = [
    { id: 'status', value: 'active', operator: 'equals' },
    { id: 'age', value: 25, operator: 'gte' },
  ]

  render(
    <TestComponent
      conditions={mockConditions}
      defaultConditions={defaultConditions}
    />,
  )

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('2')
  await expect.element(page.getByTestId('has-active')).toHaveTextContent('true')

  // Clear all
  await page.getByTestId('clear-all').click()

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('0')
  await expect
    .element(page.getByTestId('has-active'))
    .toHaveTextContent('false')
})

test('should get condition definition by id', async () => {
  render(<TestComponent conditions={mockConditions} />)

  await expect
    .element(page.getByTestId('get-status'))
    .toHaveTextContent('Status')
})

test('should get operators by type', async () => {
  render(<TestComponent conditions={mockConditions} />)

  // String operators should include: equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty
  const stringOps = page.getByTestId('string-operators')
  await expect.element(stringOps).toHaveTextContent(/[1-9]/) // At least 1 operator

  // Number operators should include: equals, not_equals, gt, gte, lt, lte
  const numberOps = page.getByTestId('number-operators')
  await expect.element(numberOps).toHaveTextContent(/[1-9]/) // At least 1 operator
})

test('should handle multiple add and remove operations', async () => {
  render(<TestComponent conditions={mockConditions} />)

  // Add status
  await page.getByTestId('add-status').click()
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('1')

  // Add age
  await page.getByTestId('add-age').click()
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('2')

  // Add another status
  await page.getByTestId('add-status').click()
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('3')

  // Remove first
  await page.getByTestId('remove-first').click()
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('2')

  // Clear all
  await page.getByTestId('clear-all').click()
  await expect.element(page.getByTestId('active-count')).toHaveTextContent('0')
})

test('should support controlled state with onChange callback', async () => {
  let lastChange: Condition<MockConditionId>[] | null = null

  function ControlledTest() {
    const [conditions, setConditions] = useState<Condition<MockConditionId>[]>(
      [],
    )
    const api = useConditions({
      conditions: mockConditions,
      value: conditions,
      onChange: (newConditions) => {
        lastChange = newConditions
        setConditions(newConditions)
      },
    })

    return (
      <div>
        <div data-testid="active-count">{api.activeConditions.length}</div>
        <button
          data-testid="add-controlled"
          onClick={() => api.addCondition({ id: 'status', value: 'active' })}
        >
          Add
        </button>
      </div>
    )
  }

  render(<ControlledTest />)

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('0')

  await page.getByTestId('add-controlled').click()

  await expect.element(page.getByTestId('active-count')).toHaveTextContent('1')
})
