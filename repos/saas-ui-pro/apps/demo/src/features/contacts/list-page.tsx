'use client'

import * as React from 'react'

import { ToggleGroup } from '@ark-ui/react'
import {
  Button,
  ButtonGroup,
  DataList,
  Flex,
  HStack,
  Portal,
  Spacer,
  createListCollection,
} from '@chakra-ui/react'
import {
  ActiveFiltersList,
  type ColumnFiltersState,
  Filter,
  type FilterItem,
  FiltersProvider,
} from '@saas-ui-pro/react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useQuery } from '@tanstack/react-query'
import { TableState } from '@tanstack/react-table'
import { useParams } from 'next/navigation'
import { LuGrid2X2, LuList, LuSlidersHorizontal, LuUser } from 'react-icons/lu'

import * as ActionBar from '#ui/action-bar/action-bar'
import * as Page from '#ui/page/page'
import * as Popover from '#ui/popover/popover'
import { getContacts } from '#api'
import { InlineSearch } from '#components/inline-search/inline-search.tsx'
import { useModals } from '#components/modals'
import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'
import { useHotkeysShortcut } from '#features/common/lib/hotkeys'
import { Command } from '#ui/command/command'
import { EmptyState } from '#ui/empty-state/empty-state'
import { IconButton } from '#ui/icon-button/icon-button'
import { Select } from '#ui/select'
import { Tooltip } from '#ui/tooltip/tooltip'

import { AddPersonDialog } from './components/add-person-dialog.tsx'
import { bulkActions } from './components/contact-bulk-actions.tsx'
import { AddFilterButton, filters } from './components/contact-filters.tsx'
import { ContactTypes } from './components/contact-types.tsx'
import { ContactsBoard } from './components/contacts-board.tsx'
import { ContactsGrid } from './components/contacts-grid.tsx'
import { useContactsColumns } from './components/use-contacts-columns.tsx'

export function ContactsListPage() {
  const modals = useModals()

  const query = useParams()

  const type = query?.type?.toString()

  const [searchQuery, setSearchQuery] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: [
      'GetContacts',
      {
        type,
        searchQuery,
      },
    ] as const,
    queryFn: async ({ queryKey }) => {
      const data = await getContacts(queryKey[1])

      if (queryKey[1].searchQuery) {
        return {
          contacts: data.contacts.filter((contact) => {
            return contact.name.includes(queryKey[1].searchQuery)
          }),
        }
      }

      return data
    },
  })

  const addPerson = () => {
    modals.open(AddPersonDialog)
  }

  const addCommand = useHotkeysShortcut('contacts.add', addPerson)

  const [groupBy, setGroupBy] = React.useState('status')

  const columns = useContactsColumns()

  const groupCollection = createListCollection({
    items: [
      { value: 'status', label: 'Status' },
      { value: 'type', label: 'Type' },
      { value: 'tags', label: 'Tag' },
    ],
  })

  const groupBySelect = (
    <Select.Root
      name="groupBy"
      value={[groupBy]}
      collection={groupCollection}
      onValueChange={({ value }) => setGroupBy(value[0] as string)}
      size="xs"
    >
      <Select.Trigger>
        <Select.ValueText placeholder="Group by" />
      </Select.Trigger>

      <Select.Content portalled={false}>
        {groupCollection.items.map((item) => (
          <Select.Item key={item.value} item={item}>
            {item.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )

  const primaryAction = (
    <Tooltip
      portalled
      content={
        <>
          Add person <Command>{addCommand}</Command>
        </>
      }
    >
      <Button variant="primary" size="sm" onClick={addPerson}>
        Add person
      </Button>
    </Tooltip>
  )

  const [view, setView] = React.useState<'list' | 'board'>('list')

  const [showSearch, setShowSearch] = React.useState(false)

  useHotkey('Mod+F', () => setShowSearch((prev) => !prev), {
    preventDefault: true,
  })

  const [visibleColumns, setVisibleColumns] = React.useState([
    'name',
    'email',
    'createdAt',
    'type',
    'status',
  ])

  const displayProperties = (
    <ToggleGroup.Root
      multiple
      value={visibleColumns}
      onValueChange={({ value }) => {
        setVisibleColumns(value as string[])
      }}
      asChild
    >
      <ButtonGroup display="flex" flexWrap="wrap" gap="1">
        {columns.map((col) => {
          if ('accessorKey' in col && col.enableHiding !== false) {
            const id = col.id || col.accessorKey
            return (
              <ToggleGroup.Item key={id} value={id} asChild>
                <Button
                  size="xs"
                  color="fg.muted"
                  borderColor="border.subtle"
                  boxShadow="none"
                  _pressed={{
                    borderColor: 'border.emphasized',
                    boxShadow: 'sm',
                  }}
                  variant="surface"
                >
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </Button>
              </ToggleGroup.Item>
            )
          }
          return null
        })}
      </ButtonGroup>
    </ToggleGroup.Root>
  )

  const toolbar = (
    <ButtonGroup>
      <ContactTypes />
      <Spacer />
      {showSearch && (
        <InlineSearch
          ref={(el) => {
            el?.focus()
          }}
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onReset={() => {
            setSearchQuery('')

            setShowSearch(false)
          }}
        />
      )}
      {primaryAction}
    </ButtonGroup>
  )

  const tabbar = (
    <ButtonGroup height="10" borderTopWidth="1px" mx="-3" px="3">
      <Flex flex="1" flexWrap="wrap" gap="2" alignItems="center">
        <ActiveFiltersList size="xs" variant="surface" />
        <AddFilterButton />
      </Flex>
      <ToggleGroup.Root
        value={[view]}
        onValueChange={({ value }) => {
          setView(value[0] as 'list' | 'board')
        }}
        asChild
      >
        <ButtonGroup width="auto" attached>
          <ToggleGroup.Item value="list" asChild>
            <IconButton
              variant="outline"
              size="xs"
              aria-label="Display as list"
            >
              <LuList />
            </IconButton>
          </ToggleGroup.Item>
          <ToggleGroup.Item value="board" asChild>
            <IconButton
              variant="outline"
              size="xs"
              aria-label="Display as board"
            >
              <LuGrid2X2 />
            </IconButton>
          </ToggleGroup.Item>
        </ButtonGroup>
      </ToggleGroup.Root>
      <Popover.Root
        size="sm"
        positioning={{
          placement: 'bottom-end',
        }}
      >
        <Popover.Trigger asChild>
          <Button variant="surface" size="xs">
            <LuSlidersHorizontal />
            Display
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Content maxW="260px">
            <Popover.Body borderBottomWidth="1px">
              <DataList.Root orientation="horizontal">
                <DataList.Item>
                  <DataList.ItemLabel>Group by</DataList.ItemLabel>
                  <DataList.ItemValue justifyContent="flex-end">
                    {groupBySelect}
                  </DataList.ItemValue>
                </DataList.Item>
              </DataList.Root>
            </Popover.Body>
            <Popover.Body>
              <DataList.Root orientation="vertical">
                <DataList.Item>
                  <DataList.ItemLabel>Display properties</DataList.ItemLabel>
                  <DataList.ItemValue>{displayProperties}</DataList.ItemValue>
                </DataList.Item>
              </DataList.Root>
            </Popover.Body>
          </Popover.Content>
        </Portal>
      </Popover.Root>
    </ButtonGroup>
  )

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )

  const onFilter = React.useCallback((filters: Filter[]) => {
    setColumnFilters(
      filters.map((filter) => {
        return {
          id: filter.id,
          value: {
            value: filter.value,
            operator: filter.operator,
          },
        }
      }) as ColumnFiltersState,
    )
  }, [])

  const onBeforeEnableFilter = React.useCallback(
    (activeFilter: Filter, filter: FilterItem): Promise<Filter> => {
      return new Promise((resolve, reject) => {
        const { key, id, value } = activeFilter
        const { type, label } = filter

        // if (type === 'date' && value === 'custom') {
        //   return modals.open({
        //     title: label,
        //     date: new Date(),
        //     onSubmit: (date: DateValue) => {
        //       resolve({
        //         key,
        //         id,
        //         value: date.toDate(getLocalTimeZone()),
        //         operator: 'after',
        //       })
        //     },
        //     onClose: () => reject(),
        //     component: DatePickerModal,
        //   })
        // }

        resolve(activeFilter)
      })
    },
    [],
  )

  const defaultFilters = React.useMemo(() => {
    if (query.tag) {
      return [
        { id: 'tags', operator: 'contains', value: query.tag },
      ] satisfies Filter[]
    }
    return []
  }, [query.tag])

  const [selections, setSelections] = React.useState<string[]>([])

  const initialState = React.useMemo(() => {
    return {
      pagination: {
        pageSize: 20,
      },
      columnPinning: {
        left: ['selection', 'name'],
        right: ['action'],
      },
    }
  }, [])

  const state = React.useMemo(() => {
    return {
      columnFilters,
      columnVisibility: Object.fromEntries(
        visibleColumns.map((column) => [column, true]),
      ),
    } satisfies Partial<TableState>
  }, [columnFilters, visibleColumns])

  let body = null

  const tableProps = {
    initialState,
    data: data?.contacts ?? [],
    state,
    onSelectedRowsChange: (rows: string[]) => {
      setSelections(rows)
    },
  }

  if (!isLoading && !data?.contacts.length) {
    body = (
      <EmptyState
        title="No people added yet"
        description="Add a person or import data to get started."
        colorPalette="primary"
        icon={<LuUser />}
      >
        <Button variant="primary" onClick={addPerson}>
          Add a person
        </Button>
        <Button>Import data</Button>
      </EmptyState>
    )
  } else if (view === 'board') {
    body = <ContactsBoard {...tableProps} />
  } else {
    body = <ContactsGrid {...tableProps} />
  }

  return (
    <FiltersProvider
      filters={filters}
      defaultFilters={defaultFilters}
      onChange={onFilter}
      onBeforeEnableFilter={onBeforeEnableFilter}
    >
      <Page.Root>
        <Page.Header
          title="People"
          nav={<SidebarToggleButton />}
          actions={toolbar}
          footer={tabbar}
        />
        <Page.Body p="0" overflow="visible" flex="1" minH="1">
          {body}
        </Page.Body>
      </Page.Root>

      <ActionBar.Root open={selections.length > 0}>
        <ActionBar.Content>
          <ActionBar.SelectionTrigger>
            {selections.length} selected
          </ActionBar.SelectionTrigger>
          <ActionBar.CloseButton />
          <ActionBar.Separator />

          <HStack flex="1" justify="flex-end">
            {bulkActions?.({ selections })}
          </HStack>
        </ActionBar.Content>
      </ActionBar.Root>
    </FiltersProvider>
  )
}
