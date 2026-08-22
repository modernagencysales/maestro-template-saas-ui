import React from 'react'

import {
  Box,
  Button,
  ChakraProvider,
  Flex,
  Group,
  HStack,
  IconButton,
  Input,
  Menu,
  Portal,
  Select,
  SelectPositioner,
  Spinner,
  Text,
  VStack,
  createListCollection,
  useFilter,
  useListCollection,
} from '@chakra-ui/react'
import { defaultSystem } from '@saas-ui/chakra-preset'
import { LuPlus, LuTrash2, LuX } from 'react-icons/lu'

import { defineConditions } from '../core/define-conditions'
import type {
  ConditionItem,
  ConditionOperatorId,
} from '../types/condition.types'
import { useConditions } from './use-conditions'
import {
  ConditionsProvider,
  useConditionsContext,
} from './use-conditions-context'

export default {
  title: 'Hooks/useConditions',
  component: () => null,
  decorators: [
    (Story) => (
      <ChakraProvider value={defaultSystem}>
        <Story />
      </ChakraProvider>
    ),
  ],
}

const allConditions = defineConditions({
  conditions: [
    {
      id: 'status',
      label: 'Status',
      type: 'enum',
      defaultOperator: 'equals',
      items: [
        { label: 'Backlog', value: 'backlog', id: 'backlog' },
        { label: 'Todo', value: 'todo', id: 'todo' },
        { label: 'In Progress', value: 'in_progress', id: 'in_progress' },
        { label: 'Done', value: 'done', id: 'done' },
        { label: 'Canceled', value: 'canceled', id: 'canceled' },
      ],
    },
    {
      id: 'priority',
      label: 'Priority',
      type: 'enum',
      defaultOperator: 'equals',
      items: [
        { label: 'No Priority', value: '0', id: '0' },
        { label: 'Urgent', value: '1', id: '1' },
        { label: 'High', value: '2', id: '2' },
        { label: 'Medium', value: '3', id: '3' },
        { label: 'Low', value: '4', id: '4' },
      ],
    },
    {
      id: 'assignee',
      label: 'Assignee',
      type: 'enum',
      defaultOperator: 'equals',
      items: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return [
          { label: 'Unassigned', value: 'unassigned', id: 'unassigned' },
          { label: 'John Doe', value: 'john_doe', id: 'john_doe' },
          { label: 'Jane Smith', value: 'jane_smith', id: 'jane_smith' },
        ]
      },
    },
    {
      id: 'title',
      label: 'Title',
      type: 'string',
      defaultOperator: 'contains',
    },
    {
      id: 'description',
      label: 'Description',
      type: 'string',
      defaultOperator: 'contains',
    },
    { id: 'created', label: 'Created', type: 'date', defaultOperator: 'gte' },
  ] as const,
}).conditions

function ActiveConditionsState() {
  const { activeConditions } = useConditionsContext()

  if (!activeConditions.length) {
    return null
  }

  return (
    <Box mt={8} p={4} bg="gray.50" borderRadius="md" fontSize="xs">
      <Text fontWeight="bold" mb={2}>
        Active Conditions State:
      </Text>
      <pre>{JSON.stringify(activeConditions, null, 2)}</pre>
    </Box>
  )
}

const ActiveFilters = () => {
  const {
    activeConditions,
    addCondition,
    removeCondition,
    updateCondition,
    getOperators,
    getOptions,
    isLoading,
  } = useConditionsContext()

  return (
    <Box>
      <Flex flexWrap="wrap" gap={2}>
        {activeConditions.map((condition) => {
          const operators = getOperators(condition.type)
          const operatorsCollection = createListCollection({
            items: operators.map((op) => ({ label: op.label, value: op.id })),
          })

          const conditionDef = allConditions.find((c) => c.id === condition.id)
          const options = getOptions(condition.id)
          const loading = isLoading(condition.id)

          const optionsCollection = options
            ? createListCollection({
                items: options.map((item) => ({
                  label: item.label,
                  value: String(item.value || item.id),
                })),
              })
            : undefined

          return (
            <Group
              key={condition.key}
              borderWidth="1px"
              borderRadius="md"
              px="1"
              gap="1px"
            >
              {/* Condition Label */}
              <Box textStyle="sm" fontWeight="medium" px="1">
                {conditionDef?.label}
              </Box>

              {/* Operator Selector */}
              <Select.Root
                collection={operatorsCollection}
                value={condition.operator ? [condition.operator] : []}
                onValueChange={(e) => {
                  updateCondition(condition.key!, {
                    operator: e.value[0] as ConditionOperatorId,
                  })
                }}
                size="sm"
                width="auto"
                positioning={{ sameWidth: false }}
              >
                <Select.Trigger
                  border="0"
                  borderRadius="0"
                  _hover={{
                    bg: 'bg.muted',
                  }}
                >
                  <Select.ValueText
                    placeholder="Operator..."
                    overflow="visible"
                    maxWidth="100%"
                  />
                </Select.Trigger>
                <Portal>
                  <SelectPositioner width="100px">
                    <Select.Content>
                      {operatorsCollection.items.map((item) => (
                        <Select.Item
                          item={item}
                          key={item.value}
                          textWrap="nowrap"
                          wordBreak="unset"
                        >
                          {item.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </SelectPositioner>
                </Portal>
              </Select.Root>

              {/* Value Input */}
              <Box flex={1}>
                {conditionDef?.type === 'enum' ? (
                  <Select.Root
                    collection={
                      optionsCollection || createListCollection({ items: [] })
                    }
                    value={condition.value ? [String(condition.value)] : []}
                    onValueChange={(e) => {
                      updateCondition(condition.key!, { value: e.value[0] })
                    }}
                    size="sm"
                    width="auto"
                    disabled={loading}
                    positioning={{ sameWidth: false }}
                  >
                    <Select.Trigger
                      border="0"
                      borderRadius="0"
                      _hover={{
                        bg: 'bg.muted',
                      }}
                    >
                      <Select.ValueText
                        placeholder={loading ? 'Loading...' : 'Select value...'}
                        maxWidth="100%"
                      />
                    </Select.Trigger>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content minWidth="140px">
                          {optionsCollection?.items.map((item) => (
                            <Select.Item item={item} key={item.value}>
                              {item.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                  </Select.Root>
                ) : conditionDef?.type === 'date' ? (
                  <Input
                    type="date"
                    size="sm"
                    value={String(condition.value || '')}
                    onChange={(e) =>
                      updateCondition(condition.key!, {
                        value: e.target.value,
                      })
                    }
                  />
                ) : (
                  <Input
                    placeholder="Value..."
                    size="sm"
                    value={String(condition.value || '')}
                    onChange={(e) =>
                      updateCondition(condition.key!, {
                        value: e.target.value,
                      })
                    }
                  />
                )}
              </Box>

              <IconButton
                aria-label="Remove filter"
                variant="ghost"
                size="xs"
                onClick={() => removeCondition(condition.key!)}
              >
                <LuX />
              </IconButton>
            </Group>
          )
        })}
      </Flex>
    </Box>
  )
}

export const ActiveConditionsList = () => {
  const conditions = useConditions({
    conditions: allConditions,
    defaultValue: [
      {
        id: 'status',
        operator: 'equals',
        value: 'backlog',
      },
      {
        id: 'priority',
        operator: 'equals',
        value: '4',
      },
    ],
  })

  return (
    <ConditionsProvider value={conditions}>
      <Box p={8} maxW="800px" mx="auto">
        <VStack align="stretch" gap={4}>
          <Text fontSize="lg" fontWeight="bold">
            Filters
          </Text>

          <ActiveFilters />
        </VStack>
      </Box>
    </ConditionsProvider>
  )
}

export const DropdownMenu = {
  render: () => {
    const conditions = useConditions({
      conditions: allConditions,
    })

    const { addCondition, getOptions, isLoading, loadItems } = conditions

    return (
      <ConditionsProvider value={conditions}>
        <Box p={8}>
          <VStack align="stretch" gap={4}>
            <HStack>
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button variant="outline" size="sm">
                    <LuPlus /> Add Filter
                  </Button>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      {allConditions.map((conditionDef) => {
                        const options = getOptions(conditionDef.id)
                        const loading = isLoading(conditionDef.id)

                        // If condition has items, show as submenu
                        if ('items' in conditionDef) {
                          return (
                            <Menu.Root
                              key={conditionDef.id}
                              positioning={{ placement: 'right-start' }}
                            >
                              <Menu.TriggerItem
                                onPointerEnter={() =>
                                  loadItems(conditionDef.id)
                                }
                              >
                                {conditionDef.label}
                                {loading && <Spinner size="xs" />}
                              </Menu.TriggerItem>
                              <Portal>
                                <Menu.Positioner>
                                  <Menu.Content>
                                    {loading ? (
                                      <Menu.Item value="loading" disabled>
                                        Loading...
                                      </Menu.Item>
                                    ) : options && options.length > 0 ? (
                                      options.map((item) => (
                                        <Menu.Item
                                          key={item.id}
                                          value={item.id}
                                          onClick={() =>
                                            addCondition({
                                              id: conditionDef.id,
                                              value: item.value || item.id,
                                            })
                                          }
                                        >
                                          {item.label}
                                        </Menu.Item>
                                      ))
                                    ) : (
                                      <Menu.Item value="no-items" disabled>
                                        No items available
                                      </Menu.Item>
                                    )}
                                  </Menu.Content>
                                </Menu.Positioner>
                              </Portal>
                            </Menu.Root>
                          )
                        }

                        // Simple condition without items
                        return (
                          <Menu.Item
                            key={conditionDef.id}
                            value={conditionDef.id}
                            onClick={() =>
                              addCondition({ id: conditionDef.id })
                            }
                          >
                            {conditionDef.label}
                          </Menu.Item>
                        )
                      })}
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </HStack>

            <ActiveFilters />

            <ActiveConditionsState />
          </VStack>
        </Box>
      </ConditionsProvider>
    )
  },
}

export const DrillDownMenu = {
  render: () => {
    const conditions = useConditions({
      conditions: allConditions,
    })

    const {
      addCondition,
      activeConditions,
      removeCondition,
      getOptions,
      isLoading,
      loadItems,
    } = conditions

    const [open, setOpen] = React.useState(false)

    const [selectedCondition, setSelectedCondition] = React.useState<
      (typeof allConditions)[number] | null
    >(null)

    return (
      <ConditionsProvider value={conditions}>
        <Box p={8}>
          <VStack align="stretch" gap={4}>
            <HStack>
              <Menu.Root
                open={open}
                closeOnSelect={false}
                onOpenChange={(details) => {
                  if (!details.open) {
                    setSelectedCondition(null)
                  }
                  setOpen(details.open)
                }}
              >
                <Menu.Trigger asChild>
                  <Button variant="outline" size="sm">
                    <LuPlus /> Add Filter
                  </Button>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      {!selectedCondition ? (
                        // Show main menu with all conditions
                        <>
                          {allConditions.map((conditionDef) => {
                            if ('items' in conditionDef) {
                              return (
                                <Menu.Item
                                  key={conditionDef.id}
                                  value={conditionDef.id}
                                  onClick={() => {
                                    loadItems(conditionDef.id)
                                    setSelectedCondition(conditionDef)
                                  }}
                                >
                                  {conditionDef.label}
                                </Menu.Item>
                              )
                            }

                            // Simple condition without items
                            return (
                              <Menu.Item
                                key={conditionDef.id}
                                value={conditionDef.id}
                                onClick={() => {
                                  addCondition({ id: conditionDef.id })
                                  setOpen(false)
                                }}
                              >
                                {conditionDef.label}
                              </Menu.Item>
                            )
                          })}
                        </>
                      ) : (
                        // Show items for selected condition
                        <>
                          <Menu.Item
                            value="back"
                            onClick={() => setSelectedCondition(null)}
                          >
                            ← Back
                          </Menu.Item>
                          <Menu.Separator />
                          {isLoading(selectedCondition.id) ? (
                            <Menu.Item value="loading" disabled>
                              <HStack>
                                <Spinner size="xs" />
                                <Text>Loading...</Text>
                              </HStack>
                            </Menu.Item>
                          ) : (
                            getOptions(selectedCondition.id)?.map((item) => (
                              <Menu.Item
                                key={item.id}
                                value={item.id}
                                onClick={() => {
                                  addCondition({
                                    id: selectedCondition.id,
                                    value: item.value || item.id,
                                  })
                                  setSelectedCondition(null)
                                  setOpen(false)
                                }}
                              >
                                {item.label}
                              </Menu.Item>
                            )) || (
                              <Menu.Item value="no-items" disabled>
                                No items available
                              </Menu.Item>
                            )
                          )}
                        </>
                      )}
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </HStack>

            <ActiveFilters />

            <ActiveConditionsState />
          </VStack>
        </Box>
      </ConditionsProvider>
    )
  },
}

export const DrillDownMenuWithFilter = () => {
  const conditions = useConditions({
    conditions: allConditions,
  })

  const {
    addCondition,
    activeConditions,
    removeCondition,
    getOptions,
    isLoading,
    loadItems,
  } = conditions

  const [open, setOpen] = React.useState(false)
  const [selectedCondition, setSelectedCondition] = React.useState<
    (typeof allConditions)[number] | null
  >(null)
  const [filterValue, setFilterValue] = React.useState('')

  // Filter for conditions
  const { contains } = useFilter({})
  const { collection, filter } = useListCollection({
    initialItems: allConditions.concat(),
    filter: contains,
    itemToString: (item) => item.label,
    itemToValue: (item) => item.id,
  })

  // Filter for condition items
  const { collection: selectedCollection, filter: selectedFilter } =
    useListCollection({
      initialItems: selectedCondition
        ? getOptions(selectedCondition.id) || []
        : [],
      filter: contains,
      itemToString: (item) => item.label,
      itemToValue: (item) => item.id,
    })

  // Reset filter when changing views
  React.useEffect(() => {
    setFilterValue('')
  }, [selectedCondition])

  return (
    <ConditionsProvider value={conditions}>
      <Box p={8}>
        <VStack align="stretch" gap={4}>
          <HStack>
            <Menu.Root
              open={open}
              closeOnSelect={false}
              onOpenChange={(details) => {
                setOpen(details.open)
              }}
              onExitComplete={() => {
                setSelectedCondition(null)
                setFilterValue('')
              }}
            >
              <Menu.Trigger asChild>
                <Button variant="outline" size="sm">
                  <LuPlus /> Add Filter
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    {/* Search Input */}
                    <HStack pb="1" mb="1" borderBottomWidth="1px" gap="0">
                      {selectedCondition ? (
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="All filters"
                          onClick={() => setSelectedCondition(null)}
                        >
                          ←
                        </IconButton>
                      ) : null}
                      <Box>
                        <Input
                          placeholder={
                            selectedCondition
                              ? `Search ${selectedCondition.label.toLowerCase()}...`
                              : 'Search conditions...'
                          }
                          size="sm"
                          border="0"
                          value={filterValue}
                          onChange={(e) => {
                            setFilterValue(e.target.value)
                            filter(e.target.value)
                          }}
                          autoFocus
                        />
                      </Box>
                    </HStack>

                    {!selectedCondition ? (
                      // Show filtered conditions
                      <>
                        {collection.items.length === 0 ? (
                          <Menu.Item value="no-results" disabled>
                            No conditions found
                          </Menu.Item>
                        ) : (
                          collection.items.map((conditionDef) => {
                            if ('items' in conditionDef) {
                              return (
                                <Menu.Item
                                  key={conditionDef.id}
                                  value={conditionDef.id}
                                  onClick={() => {
                                    loadItems(conditionDef.id)
                                    setSelectedCondition(conditionDef)
                                  }}
                                >
                                  {conditionDef.label}
                                </Menu.Item>
                              )
                            }

                            // Simple condition without items
                            return (
                              <Menu.Item
                                key={conditionDef.id}
                                value={conditionDef.id}
                                onClick={() => {
                                  addCondition({ id: conditionDef.id })
                                  setOpen(false)
                                }}
                              >
                                {conditionDef.label}
                              </Menu.Item>
                            )
                          })
                        )}
                      </>
                    ) : (
                      // Show filtered items for selected condition
                      <>
                        {isLoading(selectedCondition.id) ? (
                          <Menu.Item value="loading" disabled>
                            <HStack>
                              <Spinner size="xs" />
                              <Text>Loading...</Text>
                            </HStack>
                          </Menu.Item>
                        ) : selectedCollection.items.length === 0 ? (
                          <Menu.Item value="no-results" disabled>
                            {filterValue
                              ? 'No items found'
                              : 'No items available'}
                          </Menu.Item>
                        ) : (
                          selectedCollection.items.map((item) => (
                            <Menu.Item
                              key={item.id}
                              value={item.id}
                              onClick={() => {
                                addCondition({
                                  id: selectedCondition.id,
                                  value: item.value || item.id,
                                })
                                setSelectedCondition(null)
                                setOpen(false)
                              }}
                            >
                              {item.label}
                            </Menu.Item>
                          ))
                        )}
                      </>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </HStack>

          <ActiveFilters />

          <ActiveConditionsState />
        </VStack>
      </Box>
    </ConditionsProvider>
  )
}
