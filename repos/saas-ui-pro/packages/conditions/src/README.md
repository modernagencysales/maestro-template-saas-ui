# Condition System

A headless, type-safe condition builder for creating advanced filters and workflow rules. Built with Zag.js state machines and designed for Prisma/Drizzle ORM compatibility.

## Features

- ✅ **Headless**: Complete UI freedom via state machines and prop getters
- ✅ **Prisma/Drizzle Compatible**: Operators aligned with ORM syntax
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Async Support**: Load filter values dynamically
- ✅ **Accessible**: ARIA attributes built-in
- ✅ **Framework Agnostic**: Core logic works anywhere
- ✅ **Reusable**: Same logic for filters, queries, and workflow rules

## Installation

```bash
pnpm add @saas-ui-pro/react
```

## Basic Usage

### 1. Simple Filter

```tsx
import { useCondition } from '@saas-ui-pro/react/components/condition'

function StatusFilter() {
  const condition = useCondition({
    id: 'status',
    label: 'Status',
    defaultOperator: 'equals',
    onChange: (filter) => {
      console.log(filter) // { id: 'status', operator: 'equals', value: 'active' }
    },
  })

  return (
    <div {...condition.getRootProps()}>
      <label {...condition.getLabelProps()}>{condition.label}</label>

      <select
        value={condition.value as string}
        onChange={(e) => condition.setValue(e.target.value)}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <button {...condition.getRemoveButtonProps()}>×</button>
    </div>
  )
}
```

### 2. Filter List (Multiple Conditions)

```tsx
import { useConditions, toPrismaWhere } from '@saas-ui-pro/react/components/condition'

function ContactFilters() {
  const conditions = useConditions({
    conditions: [
      { id: 'status', label: 'Status', type: 'enum' },
      { id: 'role', label: 'Role', type: 'enum' },
      { id: 'createdAt', label: 'Created Date', type: 'date' },
    ],
    onChange: (activeConditions) => {
      // Convert to Prisma format
      const prismaWhere = toPrismaWhere(activeConditions)

      // Send to backend
      fetchContacts({ where: prismaWhere })
    },
  })

  return (
    <div {...conditions.getRootProps()}>
      <div {...conditions.getListProps()}>
        {conditions.activeConditions.map((condition) => (
          <div key={condition.key} {...conditions.getItemProps(condition.key!)}>
            {/* Render filter chip */}
          </div>
        ))}
      </div>

      <button onClick={() => conditions.addCondition({ id: 'status', value: 'active' })}>
        Add Filter
      </button>

      <button {...conditions.getClearButtonProps()}>Clear All</button>
    </div>
  )
}
```

### 3. With Async Value Selection

```tsx
import { useConditionValue } from '@saas-ui-pro/react/components/condition'

function AssigneeFilter() {
  const value = useConditionValue({
    id: 'assignee',
    items: async ({ query }) => {
      // Load users from API
      const users = await fetchUsers({ search: query })
      return users.map(u => ({ id: u.id, label: u.name }))
    },
    onChange: (selected) => {
      console.log('Selected:', selected)
    },
  })

  return (
    <div>
      <button {...value.getTriggerProps()}>
        {value.selectedItems[0]?.label || 'Select assignee...'}
      </button>

      {value.isOpen && (
        <div {...value.getContentProps()}>
          <input {...value.getInputProps()} placeholder="Search users..." />

          {value.isLoading && <div>Loading...</div>}

          {value.filteredItems.map((item) => (
            <div key={item.id} {...value.getItemProps(item)}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Backend Integration

### Prisma Example

```tsx
// Frontend
import { useConditions, toPrismaWhere } from '@saas-ui-pro/react/components/condition'

function ContactList() {
  const conditions = useConditions({
    conditions: [
      { id: 'status', label: 'Status', type: 'enum', defaultOperator: 'equals' },
      { id: 'createdAt', label: 'Created', type: 'date', defaultOperator: 'gte' },
    ],
    onChange: async (activeConditions) => {
      const where = toPrismaWhere(activeConditions)
      // Example: { status: { equals: 'active' }, createdAt: { gte: '2024-01-01' } }

      const contacts = await fetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ where }),
      }).then(r => r.json())

      setContacts(contacts)
    },
  })
}

// Backend (Next.js API route)
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { where } = await req.json()

  const contacts = await prisma.contact.findMany({
    where, // Prisma format directly!
  })

  return Response.json(contacts)
}
```

### Drizzle Example

```tsx
// Frontend
import { useConditions, toDrizzleFilter } from '@saas-ui-pro/react/components/condition'

function ContactList() {
  const conditions = useConditions({
    conditions: [
      { id: 'status', label: 'Status', type: 'enum' },
      { id: 'age', label: 'Age', type: 'number' },
    ],
    onChange: async (activeConditions) => {
      const filters = toDrizzleFilter(activeConditions)
      // Example: [
      //   { operator: 'eq', field: 'status', value: 'active' },
      //   { operator: 'gte', field: 'age', value: 18 }
      // ]

      const contacts = await fetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ filters }),
      }).then(r => r.json())

      setContacts(contacts)
    },
  })
}

// Backend
import { db } from '@/lib/db'
import { contacts } from '@/lib/schema'
import { eq, gte, and } from 'drizzle-orm'

export async function POST(req: Request) {
  const { filters } = await req.json()

  // Map filters to Drizzle operators
  const conditions = filters.map((f: any) => {
    const operatorMap = {
      eq: eq,
      gte: gte,
      // ... other operators
    }

    const op = operatorMap[f.operator]
    return op(contacts[f.field], f.value)
  })

  const results = await db.select().from(contacts).where(and(...conditions))

  return Response.json(results)
}
```

## Available Operators

Aligned with Prisma filter operators:

| Operator | Label | Types | Prisma Equivalent |
|----------|-------|-------|-------------------|
| `equals` | equals | all | `{ field: { equals: value } }` |
| `not` | not equals | all | `{ field: { not: value } }` |
| `gt` | greater than | number, date | `{ field: { gt: value } }` |
| `gte` | greater than or equal | number, date | `{ field: { gte: value } }` |
| `lt` | less than | number, date | `{ field: { lt: value } }` |
| `lte` | less than or equal | number, date | `{ field: { lte: value } }` |
| `contains` | contains | string | `{ field: { contains: value } }` |
| `startsWith` | starts with | string | `{ field: { startsWith: value } }` |
| `endsWith` | ends with | string | `{ field: { endsWith: value } }` |
| `in` | is any of | enum, string, number | `{ field: { in: [values] } }` |
| `notIn` | is none of | enum, string, number | `{ field: { notIn: [values] } }` |
| `hasSome` | has some of | enum | `{ field: { hasSome: [values] } }` |
| `hasEvery` | has all of | enum | `{ field: { hasEvery: [values] } }` |
| `isNull` | is empty | all | `{ field: null }` |
| `isNotNull` | is not empty | all | `{ field: { not: null } }` |

## Custom Operators

```tsx
import { createOperators, useConditions } from '@saas-ui-pro/react/components/condition'

const customOperators = createOperators([
  {
    id: 'isToday',
    label: 'is today',
    types: ['date'],
    comparator: (value: Date) => {
      const today = new Date()
      return value.toDateString() === today.toDateString()
    },
  },
  {
    id: 'isMe',
    label: 'is me',
    types: ['enum'],
    comparator: (value: string, currentUserId: string) => {
      return value === currentUserId
    },
  },
])

function MyFilters() {
  const conditions = useConditions({
    conditions: [...],
    operators: customOperators,
  })
}
```

## Advanced: Workflow Rules

Same hooks work for workflow rule builders:

```tsx
import { useConditions } from '@saas-ui-pro/react/components/condition'

function WorkflowRuleBuilder() {
  const conditions = useConditions({
    conditions: [
      { id: 'status', label: 'Status changes to', type: 'enum' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    onChange: (rules) => {
      // Save workflow trigger conditions
      saveWorkflow({
        trigger: { conditions: rules },
        actions: [...],
      })
    },
  })

  return (
    <div>
      <h3>When ALL of these conditions match:</h3>
      {/* Render conditions */}
    </div>
  )
}
```

## Type Safety

```tsx
import type { Condition, ConditionOperatorId } from '@saas-ui-pro/react/components/condition'

// Extend with custom operators
type MyOperatorId = ConditionOperatorId | 'isToday' | 'isMe'

interface MyCondition extends Omit<Condition, 'operator'> {
  operator: MyOperatorId
}
```

## API Reference

See individual hook documentation:
- [`useCondition`](./use-condition.ts) - Single condition management
- [`useConditions`](./use-conditions.ts) - Multiple conditions
- [`useConditionValue`](./use-condition-value.ts) - Value selection with async support
