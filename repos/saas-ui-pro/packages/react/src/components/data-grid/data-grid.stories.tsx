import * as React from 'react'
import { useMemo, useRef } from 'react'

import {
  Box,
  Button,
  ButtonGroup,
  Container,
  Group,
  HStack,
  Heading,
  IconButton,
  Portal,
  Stack,
  Table,
  Text,
  VisuallyHidden,
  useDisclosure,
} from '@chakra-ui/react'
import { rand, randFirstName, randUser } from '@ngneat/falso'
import { sumBy } from 'lodash'
import { LuEllipsisVertical } from 'react-icons/lu'
import {
  RiAddFill,
  RiArrowDownFill,
  RiArrowLeftFill,
  RiArrowRightFill,
  RiArrowUpFill,
  RiSubtractFill,
} from 'react-icons/ri'

import * as Drawer from '#registry/default/ui/drawer/drawer'
import * as Menu from '#registry/default/ui/menu/menu'
import * as Page from '#registry/default/ui/page/page'
import { ChevronDownIcon } from '#registry/default/icons/chevron-down-icon'
import { ChevronUpIcon } from '#registry/default/icons/chevron-up-icon'
import { AppShell } from '#registry/default/ui/app-shell/app-shell'
import { EmptyState } from '#registry/default/ui/empty-state/empty-state'
import { SearchInput } from '#registry/default/ui/search-input/search-input'

import * as DataGridPagination from './data-grid-pagination'
import {
  ColumnDef,
  ColumnFiltersState,
  DataGrid,
  DataGridCell,
  DataGridCheckbox,
  DataGridProps,
  PaginationState,
  SortingState,
  TableInstance,
  useColumnVisibility,
  useColumns,
} from '.'

export default {
  title: 'Components/Data Display/DataGrid',
  component: DataGrid,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story: any) => (
      <Box height="100dvh">
        <Story />
      </Box>
    ),
  ],
} as Meta

const Template: React.FC<DataGridProps<ExampleData>> = ({
  data,
  columns,
  initialState,
  ...args
}) => (
  <DataGrid<ExampleData>
    data={data}
    columns={columns}
    initialState={initialState}
    {...args}
  />
)

const statuses = {
  new: {
    label: 'New',
  },
  active: {
    label: 'Active',
  },
  inactive: {
    label: 'Inactive',
  },
}

const StatusCell: DataGridCell<ExampleData> = (cell) => {
  const status = statuses[cell.getValue<keyof typeof statuses>()]
  return <Box>{status.label}</Box>
}

const ActionCell: DataGridCell<ExampleData> = () => {
  return (
    <Stack
      onClick={(e) => e.stopPropagation()}
      alignItems="flex-end"
      width="full"
    >
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Actions"
            size="xs"
            variant="ghost"
            colorPalette="gray"
          >
            <LuEllipsisVertical />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Content>
            <Menu.Item value="delete">Delete</Menu.Item>
          </Menu.Content>
        </Portal>
      </Menu.Root>
    </Stack>
  )
}

const columns: ColumnDef<ExampleData>[] = [
  {
    accessorKey: 'firstName',
    header: 'Name',
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    meta: {
      isNumeric: true,
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    size: 300,
  },
  {
    accessorKey: 'address',
    accessorFn: (data) => {
      return `${data.address.street}, ${data.address.city}, ${data.address.zipCode}`
    },
    header: 'Address',
  },
  {
    accessorKey: 'revenue',
    header: 'Revenue',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: StatusCell,
  },
  {
    id: 'action',
    header: () => <VisuallyHidden>Actions</VisuallyHidden>,
    cell: ActionCell,
    size: 50,
    enableSorting: false,
    enableResizing: false,
    meta: {
      cellProps: {
        py: 0,
      },
    },
  },
]

const makeData = (length = 1000) => {
  return randUser({
    length,
  }).map((user) => {
    return {
      ...user,
      phone: user.phone.split(',')[0],
      status: rand(['new', 'active', 'inactive']),
      revenue: Math.floor(Math.random() * 1000),
    }
  })
}

const data: ExampleData[] = makeData()

type ExampleData = {
  status: string
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  img: string
  address: {
    street: string
    city: string
    zipCode: string
    country?: string
  }
  phone: string
  revenue?: number
}
const initialState = {
  columnVisibility: { phone: false, employees: false },
}

export const Basic = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
  },
}

export const Sortable = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
    isSortable: true,
  },
}

export const Selectable = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
    isSelectable: true,
  },
}

export const LayoutMode = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
    layoutMode: 'fixed',
  },
}

export const ColumnResizing = {
  render: Template,
  args: {
    columns,
    columnResizeEnabled: true,
    data,
    initialState,
    isSelectable: true,
  },
}

export const ColorScheme = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
    isSelectable: true,
    colorScheme: 'cyan',
  },
}

export const Empty = {
  render: Template,
  args: {
    columns,
    data: [],
    initialState,
    emptyState: () => (
      <EmptyState
        title="No data"
        description="There is no data to be displayed."
      />
    ),
  },
}

export const NoTruncate = {
  render: Template,
  args: {
    columns: columns.map((column) => {
      if ('accessorKey' in column && column.accessorKey === 'address') {
        return {
          ...column,
          meta: {
            ...column.meta,
            isTruncated: false,
          },
        }
      }

      return column
    }),
    data,
    initialState,
    truncate: false,
  },
}

export const InitialSelected = {
  render: Template,
  args: {
    columns,
    data,
    initialState: {
      ...initialState,
      rowSelection: { 1: true },
    },
    isSelectable: true,
  },
}

export const SelectedChange = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
    isSelectable: true,
    onSelectedRowsChange: (rows: string[]) => console.log(rows),
  },
}

export const SelectableAndSortable = {
  render: Template,
  args: {
    columns,
    data,
    initialState,
    isSortable: true,
    isSelectable: true,
    focusMode: 'grid',
  },
}

export const Numeric = {
  render: Template,
  args: {
    columns,
    data,
    initialState: {
      columnVisibility: { phone: true },
    },
  },
}

const withLinks = columns.concat().map((column) => {
  if (!('accessorKey' in column)) {
    return column
  }
  if (column.accessorKey === 'firstName') {
    return Object.assign({}, column, {
      meta: {
        href: (data: ExampleData) => {
          return `/customers/${data.id}`
        },
        ...column.meta,
      },
    })
  }
  return column
})

export const WithLink = {
  render: Template,
  args: {
    columns: withLinks,
    data,
    initialState,
  },
}

export const TableInstanceRef = () => {
  const ref = React.useRef<TableInstance<ExampleData>>(null)

  return (
    <>
      <Stack direction="row" mb="8">
        <Button onClick={() => ref.current?.toggleAllRowsSelected()}>
          Toggle select all
        </Button>
      </Stack>
      <DataGrid<ExampleData>
        instanceRef={ref}
        columns={columns}
        data={data}
        isSelectable
        isSortable
      />
    </>
  )
}

function Pagination(props: DataGridPagination.RootProps) {
  return (
    <DataGridPagination.Root {...props}>
      <DataGridPagination.PageControl />

      <DataGridPagination.PreviousButton />
      <DataGridPagination.Items />
      <DataGridPagination.NextButton />
    </DataGridPagination.Root>
  )
}

export const WithPagination = {
  render: () => {
    return (
      <Template
        data={data}
        columns={columns}
        initialState={{ pagination: { pageSize: 1 } }}
      >
        <Pagination />
      </Template>
    )
  },
}

export const WithControlledPagination = {
  render: () => {
    const [pagination, setPagination] = React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    })

    return (
      <Template
        data={data}
        columns={columns}
        onPaginationChange={setPagination}
        initialState={{
          pagination,
        }}
        state={{
          pagination,
        }}
      >
        <Pagination />
      </Template>
    )
  },
}

export const WithRemoteSort = {
  render: () => {
    const [sort, setSort] = React.useState<SortingState>([])

    const sortedData = React.useMemo(() => {
      const key = sort[0]?.id
      const desc = sort[0]?.desc

      return data.concat().sort((a: any, b: any) => {
        if (key && a[key] > b[key]) {
          return desc ? -1 : 1
        }

        if (key && a[key] < b[key]) {
          return desc ? 1 : -1
        }

        return 0
      })
    }, [sort])

    return (
      <Template
        data={sortedData}
        columns={columns}
        isSortable
        state={{
          sorting: sort,
        }}
        enableMultiSort={false}
        onSortingChange={setSort}
      />
    )
  },
}

export const WithFilteredData = {
  render: () => {
    const ref = React.useRef<TableInstance<ExampleData>>(null)

    const filters = React.useMemo<ColumnFiltersState>(() => {
      return [
        {
          id: 'status',
          value: 'new',
        },
      ]
    }, [])

    const [status, setStatus] = React.useState('new')

    React.useEffect(() => {
      ref.current?.setColumnFilters(() => {
        return [
          {
            id: 'status',
            value: status,
          },
        ]
      })
    }, [status])

    return (
      <>
        <HStack justify="space-between">
          <Group attached my="4">
            <Button
              data-active={status === 'new'}
              onClick={() => setStatus('new')}
            >
              New
            </Button>
            <Button
              data-active={status === 'active'}
              onClick={() => setStatus('active')}
            >
              Active
            </Button>
            <Button
              data-active={status === 'deleted'}
              onClick={() => setStatus('deleted')}
            >
              Deleted
            </Button>
          </Group>

          <Box>
            <SearchInput
              size="sm"
              defaultValue=""
              onChange={(e) => {
                ref.current?.setGlobalFilter(e.target.value)
              }}
              onReset={() => {
                ref.current?.setGlobalFilter(undefined)
              }}
            />
          </Box>
        </HStack>
        <DataGrid<ExampleData>
          instanceRef={ref}
          columns={columns}
          data={data}
          isSelectable
          isSortable
          initialState={{
            pagination: {
              pageSize: 20,
            },
            columnFilters: filters,
          }}
        >
          <Pagination />
        </DataGrid>
      </>
    )
  },
}

export const WithRemoteFilters = {
  render: () => {
    const ref = React.useRef<TableInstance<ExampleData>>(null)

    const [status, setStatus] = React.useState('new')

    const filteredData = React.useMemo(() => {
      return data.filter((row) => {
        return row.status === status
      })
    }, [status])

    return (
      <>
        <Group attached mb="8">
          <Button
            data-active={status === 'new'}
            onClick={() => setStatus('new')}
          >
            New
          </Button>
          <Button
            data-active={status === 'active'}
            onClick={() => setStatus('active')}
          >
            Active
          </Button>
          <Button
            data-active={status === 'deleted'}
            onClick={() => setStatus('deleted')}
          >
            Deleted
          </Button>
        </Group>
        <DataGrid<ExampleData>
          instanceRef={ref}
          columns={columns}
          data={filteredData}
          isSelectable
          isSortable
          initialState={{
            pagination: {
              pageSize: 20,
            },
          }}
        />
      </>
    )
  },
}

export const CustomStickyHeaders = {
  render: () => {
    return (
      <AppShell height="400px" top="0">
        <DataGrid<ExampleData>
          css={{
            '& thead': {
              boxShadow: 'sm',
            },
          }}
          columns={columns}
          data={data}
          isSelectable
          isSortable
          initialState={{
            pagination: {
              pageSize: 100,
            },
          }}
        />
      </AppShell>
    )
  },
}

const columnsWithSelection: ColumnDef<ExampleData>[] = [
  {
    id: 'selection',
    cell: ({ row }) =>
      row.getCanSelect() ? (
        <DataGridCheckbox
          checked={
            row.getIsSomeSelected() ? 'indeterminate' : row.getIsSelected()
          }
          onChange={row.getToggleSelectedHandler()}
          aria-label={row.getIsSelected() ? 'Deselect row' : 'Select row'}
        />
      ) : null,
  },
  ...columns,
]

export const WithCustomCheckbox = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columnsWithSelection}
        data={data}
        isSelectable
        isSortable
        initialState={{
          pagination: {
            pageSize: 100,
          },
        }}
        enableRowSelection={(row) => {
          return row.original.status !== 'inactive'
        }}
      />
    )
  },
}

const withSubRows = data.map((row) => {
  return {
    ...row,
    subRows: [
      {
        ...row,
        id: `${row.id}-1`,
      },
      {
        ...row,
        id: `${row.id}-2`,
      },
    ],
  }
})

export const WithSubRows = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columns}
        data={withSubRows}
        isSortable
        isExpandable
        initialState={{
          pagination: {
            pageSize: 100,
          },
          expanded: {
            0: true,
          },
        }}
      />
    )
  },
}

const withDeepSubRows = data.map((row, i) => {
  return {
    ...row,
    subRows: [
      {
        ...data[i + 1],
        id: `${row.id}-1`,
        subRows: [
          {
            ...data[i + 2],
            id: `${row.id}-1-1`,
            subRows: [
              {
                ...data[i + 3],
                id: `${row.id}-1-1-1`,
              },
            ],
          },
        ],
      },
    ],
  }
})

export const WithDeepSubRows = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columns}
        data={withDeepSubRows}
        isSortable
        isExpandable
        initialState={{
          pagination: {
            pageSize: 100,
          },
          columnVisibility: {
            phone: false,
          },
        }}
      />
    )
  },
}

const columnsWithExpander: ColumnDef<ExampleData>[] = [
  {
    id: 'expand',
    header: '',
    size: 1,
    enableSorting: false,
    meta: {
      cellProps: {
        px: 2,
        textOverflow: 'initial',
      },
    },
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <IconButton
          size="xs"
          rounded="full"
          variant="ghost"
          fontSize="1.2em"
          aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
          onClick={row.getToggleExpandedHandler()}
        >
          {row.getIsExpanded() ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </IconButton>
      ) : null
    },
  },
  ...columns,
]

export const WithCustomExpander = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columnsWithExpander}
        data={withSubRows}
        isSortable
        initialState={{
          pagination: {
            pageSize: 100,
          },
          expanded: {
            0: true,
          },
        }}
      />
    )
  },
}

export const WithSubRowsAndSelections = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columns}
        data={withSubRows}
        striped
        isHoverable
        isSelectable
        isSortable
        isExpandable
        initialState={{
          pagination: {
            pageSize: 100,
          },
          expanded: {
            0: true,
          },
        }}
      />
    )
  },
}

export const WithCustomIcons = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columns}
        data={withSubRows}
        isSortable
        isExpandable
        icons={{
          sortAscending: <RiArrowUpFill />,
          sortDescending: <RiArrowDownFill />,
          rowExpanded: <RiSubtractFill />,
          rowCollapsed: <RiAddFill />,
          nextPage: <RiArrowRightFill />,
          previousPage: <RiArrowLeftFill />,
        }}
      >
        <Pagination />
      </DataGrid>
    )
  },
}

const makeColumns = (num: number) =>
  [...Array(num)].map((_, i) => {
    return {
      accessorKey: i.toString(),
      header: 'Column ' + i.toString(),
      size: Math.floor(Math.random() * 150) + 100,
    }
  })

const makeVirtualizedData = (num: number, columns: ColumnDef<any>[]) =>
  [...Array(num)].map(() => ({
    ...Object.fromEntries(
      columns.map((col) => [
        'accessorKey' in col ? col.accessorKey : col.id,
        randFirstName(),
      ]),
    ),
  }))

type Person = ReturnType<typeof makeData>[0]

export const WithLargeDataSet = {
  render: () => {
    const columns = React.useMemo(() => makeColumns(14), [])

    const [data] = React.useState(makeVirtualizedData(1_000_0, columns))

    return (
      <DataGrid<Person>
        columns={columns}
        data={data}
        initialState={{
          pagination: {
            pageSize: -1, // render allow rows.
          },
        }}
        columnVirtualizerOptions={{
          enabled: false,
        }}
      />
    )
  },
}

export const DynamicPagination = {
  render() {
    const ref = React.useRef<HTMLTableElement>(null)

    const columns = React.useMemo(() => makeColumns(1_000), [])
    const [data] = React.useState(makeVirtualizedData(1_000, columns))

    const [pagination, setPagination] = React.useState({
      pageIndex: 0,
      pageSize: 20,
    })

    const calcPerPage = React.useCallback(() => {
      const offset = 88 // header + footer (pagination)
      const parent = ref.current?.parentElement
      const gridHeight = parent?.offsetHeight ? parent.offsetHeight - offset : 0

      const rowHeight =
        parent?.querySelector<HTMLTableRowElement>('tbody > tr')
          ?.offsetHeight ?? 40

      if (gridHeight && rowHeight) {
        setPagination((state) => ({
          ...state,
          pageSize: Math.ceil(gridHeight / rowHeight),
        }))
      }
    }, [])

    React.useEffect(() => {
      calcPerPage()

      window.addEventListener('resize', calcPerPage)

      return () => window.removeEventListener('resize', calcPerPage)
    }, [data])

    return (
      <DataGrid
        ref={ref}
        data={data}
        columns={columns}
        onPaginationChange={setPagination}
        state={{
          pagination,
        }}
      >
        <Pagination />
      </DataGrid>
    )
  },
}

export const SlotProps = {
  render: () => {
    return (
      <DataGrid<ExampleData>
        columns={columns}
        data={withSubRows}
        isSortable
        slotProps={{
          row({ row }) {
            return {
              bg: row.original.status === 'new' ? 'red.50' : undefined,
            }
          },
          cell({ cell }) {
            return {
              bg: cell.column.id === 'status' ? 'blue.50' : undefined,
            }
          },
        }}
      />
    )
  },
}

export const UseColumns = {
  render: () => {
    const columns = useColumns<ExampleData>(
      (helper) => [
        helper.accessor('firstName', {
          header: 'First Name',
        }),
        helper.accessor('lastName', {
          header: 'Last Name',
        }),
        helper.accessor('email', {
          header: 'Email',
        }),
        helper.accessor('phone', {
          header: 'Phone',
          meta: {
            isNumeric: true,
          },
        }),
        helper.accessor('address.country', {
          header: 'Country',
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: StatusCell,
        }),
        helper.actions({
          cell: ActionCell,
          size: 60,
        }),
      ],
      [],
    )

    return <DataGrid<ExampleData> columns={columns} data={data} isSortable />
  },
}

const accessorKey = (column: ColumnDef<ExampleData>) => {
  if ('accessorKey' in column) {
    return column.accessorKey
  }
  return column.id as string
}

export const VisibleColumns = {
  render() {
    const columns = useColumns<ExampleData>(
      (helper) => [
        helper.accessor('firstName', {
          header: 'First Name',
        }),
        helper.accessor('lastName', {
          header: 'Last Name',
        }),
        helper.accessor('email', {
          header: 'Email',
        }),
        helper.accessor('phone', {
          header: 'Phone',
          meta: {
            isNumeric: true,
          },
        }),
        helper.accessor('address.country', {
          header: 'Country',
        }),
        helper.accessor('revenue', {
          header: 'Revenue',
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: StatusCell,
        }),
        helper.display({
          id: 'action',
          header: '',
          cell: ActionCell,
          size: 50,
          enableSorting: false,
          enableResizing: false,
        }),
      ],
      [],
    )

    const allColumns = columns
      .filter(
        (column) => !!accessorKey(column) && column.enableHiding !== false,
      )
      .map(accessorKey)

    const [visibleColumns, setVisibleColumns] = React.useState([
      'firstName',
      'email',
      'address.country',
    ])

    const columnVisibility = useColumnVisibility({
      columns,
      visibleColumns,
    })

    return (
      <Page.Root title="Customers" height="400px">
        <Page.Header
          title="Customers"
          actions={
            <ButtonGroup>
              <Menu.Root closeOnSelect={false}>
                <Menu.Trigger asChild>
                  <Button>View</Button>
                </Menu.Trigger>
                <Menu.Content zIndex="dropdown">
                  {allColumns.map((c) => (
                    <Menu.CheckboxItem
                      key={c}
                      value={c as string}
                      checked={visibleColumns.includes(c as string)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setVisibleColumns((prev) => [...prev, c as string])
                        } else {
                          setVisibleColumns((prev) =>
                            prev.filter((col) => col !== c),
                          )
                        }
                      }}
                    >
                      {c}
                    </Menu.CheckboxItem>
                  ))}
                </Menu.Content>
              </Menu.Root>
            </ButtonGroup>
          }
        />
        <Page.Body p="0" position="relative">
          <DataGrid
            columns={columns.concat()}
            data={data}
            isSelectable
            state={{
              columnVisibility,
            }}
          />
        </Page.Body>
      </Page.Root>
    )
  },
}

export const PinnedColumns = {
  render() {
    return (
      <Page.Root height="400px">
        <Page.Header title="Customers" />
        <Page.Body p="0" position="relative">
          <DataGrid
            columns={columns}
            columnResizeEnabled
            // layoutMode="grow"
            data={data}
            isSelectable
            focusMode="grid"
            state={{
              columnPinning: {
                left: ['selection', 'firstName', 'email'],
                right: ['status', 'action'],
              },
            }}
          />
        </Page.Body>
      </Page.Root>
    )
  },
}

export const NoVirtualization = {
  render() {
    return (
      <Page.Root height="400px">
        <Page.Header title="Customers" />
        <Page.Body p="0" position="relative">
          <DataGrid
            columns={columns}
            data={data}
            columnVirtualizerOptions={{
              enabled: false,
            }}
            rowVirtualizerOptions={{
              enabled: false,
            }}
          />
        </Page.Body>
      </Page.Root>
    )
  },
}

export const RowContextMenu = {
  render() {
    return (
      <DataGrid
        columns={columns}
        data={data}
        slotProps={{
          row: () => ({
            as: RowWithContext,
          }),
        }}
      />
    )
  },
}

const RowWithContext = React.forwardRef<HTMLTableRowElement, Table.RowProps>(
  (props: Table.RowProps, ref) => {
    return (
      <Menu.Root lazyMount>
        <Menu.ContextTrigger as={Table.Row} ref={ref} {...props} />
        <Portal>
          <Menu.Content>
            <Menu.Item value="edit">Edit</Menu.Item>
            <Menu.Item value="copy">Copy</Menu.Item>
            <Menu.Item value="delete">Delete</Menu.Item>
          </Menu.Content>
        </Portal>
      </Menu.Root>
    )
  },
)

export const WithDrawer = {
  render: () => {
    const { open, onOpen, onClose } = useDisclosure()
    const [selectedRow, setSelectedRow] = React.useState<ExampleData | null>(
      null,
    )
    const rowRef = React.useRef<HTMLTableRowElement | null>(null)
    const handleRowAction = (row: ExampleData) => {
      setSelectedRow(row)
      onOpen()
    }
    return (
      <>
        <DataGrid<ExampleData>
          getRowId={(row) => row.id}
          data={data}
          columns={columns}
          initialState={initialState}
          slotProps={{
            row: ({ row }) => {
              return {
                ref: rowRef, // not sure if this is actually working
                onKeyUp: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleRowAction(row.original)
                  }
                },
              }
            },
          }}
          onRowClick={(row) => handleRowAction(row.original)}
        />
        <Drawer.Root
          open={open}
          onOpenChange={({ open }) => (open ? onOpen() : onClose())}
          size="lg"
        >
          <Drawer.Backdrop />
          <Drawer.Content>
            <Drawer.Header>
              <Heading>
                {selectedRow?.firstName ?? ''} {selectedRow?.lastName ?? ''}
              </Heading>
            </Drawer.Header>
            <Drawer.Body>
              <Text>{selectedRow?.email ?? ''}</Text>
              <Text>{selectedRow?.phone ?? ''}</Text>
              <Text>{selectedRow?.address.street ?? ''}</Text>
              <Text>{selectedRow?.address.city ?? ''}</Text>
              <Text>{selectedRow?.address.zipCode ?? ''}</Text>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      </>
    )
  },
}

export const WithFooter = {
  render: () => {
    const columns = useColumns<ExampleData>(
      (helper) => [
        helper.accessor('firstName', {
          header: 'First Name',
        }),
        helper.accessor('lastName', {
          header: 'Last Name',
        }),
        helper.accessor('email', {
          header: 'Email',
        }),
        helper.accessor('phone', {
          header: 'Phone',
          meta: {
            isNumeric: true,
          },
        }),
        helper.accessor('address.country', {
          header: 'Country',
        }),
        helper.accessor('revenue', {
          header: 'Revenue',
          footer: ({ table }) => {
            const pageTotal = sumBy(table.getRowModel().rows, (row) => {
              const value = row.getValue('revenue')

              if (typeof value === 'number') {
                return value
              }

              if (typeof value === 'string') {
                const parsedValue = parseFloat(value)
                return isNaN(parsedValue) ? 0 : parsedValue
              }

              return 0
            })

            return pageTotal
          },
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: StatusCell,
        }),
        helper.display({
          id: 'action',
          header: '',
          cell: ActionCell,
          size: 50,
          enableSorting: false,
          enableResizing: false,
        }),
      ],
      [],
    )

    return (
      <DataGrid<ExampleData>
        getRowId={(row) => row.id}
        data={data}
        columns={columns}
        initialState={initialState}
      />
    )
  },
}

export const DisableStickyFooter = {
  render: () => {
    const columns = useColumns<ExampleData>(
      (helper) => [
        helper.accessor('firstName', {
          header: 'First Name',
        }),
        helper.accessor('lastName', {
          header: 'Last Name',
        }),
        helper.accessor('email', {
          header: 'Email',
        }),
        helper.accessor('phone', {
          header: 'Phone',
          meta: {
            isNumeric: true,
          },
        }),
        helper.accessor('address.country', {
          header: 'Country',
        }),
        helper.accessor('revenue', {
          header: 'Revenue',
          footer: ({ table }) => {
            const pageTotal = sumBy(table.getRowModel().rows, (row) => {
              const value = row.getValue('revenue')

              if (typeof value === 'number') {
                return value
              }

              if (typeof value === 'string') {
                const parsedValue = parseFloat(value)
                return isNaN(parsedValue) ? 0 : parsedValue
              }

              return 0
            })

            return pageTotal
          },
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: StatusCell,
        }),
        helper.display({
          id: 'action',
          header: '',
          cell: ActionCell,
          size: 50,
          enableSorting: false,
          enableResizing: false,
        }),
      ],
      [],
    )

    return (
      <Box h="400px">
        <DataGrid<ExampleData>
          getRowId={(row) => row.id}
          data={data}
          columns={columns}
          initialState={initialState}
          stickyFooter={false}
        />
      </Box>
    )
  },
}

export const FooterWithPinnedColumns = {
  render: () => {
    const columns = useColumns<ExampleData>(
      (helper) => [
        helper.accessor('firstName', {
          header: 'First Name',
        }),
        helper.accessor('lastName', {
          header: 'Last Name',
        }),
        helper.accessor('email', {
          header: 'Email',
        }),
        helper.accessor('phone', {
          header: 'Phone',
          meta: {
            isNumeric: true,
          },
        }),
        helper.accessor('address.country', {
          header: 'Country',
        }),
        helper.accessor('revenue', {
          header: 'Revenue',
          footer: ({ table }) => {
            const pageTotal = sumBy(table.getRowModel().rows, (row) => {
              const value = row.getValue('revenue')

              if (typeof value === 'number') {
                return value
              }

              if (typeof value === 'string') {
                const parsedValue = parseFloat(value)
                return isNaN(parsedValue) ? 0 : parsedValue
              }

              return 0
            })

            return pageTotal
          },
        }),
        helper.accessor('status', {
          header: 'Status',
          cell: StatusCell,
        }),
        helper.display({
          id: 'action',
          header: '',
          cell: ActionCell,
          size: 50,
          enableSorting: false,
          enableResizing: false,
        }),
      ],
      [],
    )

    return (
      <Box h="400px">
        <DataGrid<ExampleData>
          getRowId={(row) => row.id}
          data={data}
          columns={columns}
          initialState={initialState}
          state={{
            columnPinning: {
              left: ['firstName', 'lastName'],
              right: ['action'],
            },
          }}
        />
      </Box>
    )
  },
}

interface SampleData {
  id: number
  pinnedColumn: string
  [key: string]: string | number // for dynamic columns
}

export const CellSelection = () => {
  const gridRef = useRef<TableInstance<SampleData> | null>(null)

  // Generate sample data
  const data = useMemo(() => {
    return Array.from({ length: 50 }, (_, index) => {
      const row: SampleData = {
        id: index,
        pinnedColumn: `Pinned ${index}`,
      }
      // Add 20 additional columns
      for (let i = 1; i <= 30; i++) {
        row[`column${i}`] = `Value ${i}-${index}`
      }
      return row
    })
  }, [])

  // Generate columns
  const columns = useMemo(() => {
    const cols = [
      {
        id: 'pinnedColumn',
        header: 'Pinned Column',
        accessorKey: 'pinnedColumn',
        size: 150,
      },
    ]

    // Add 20 additional columns
    for (let i = 1; i <= 30; i++) {
      cols.push({
        id: `column${i}`,
        header: `Column ${i}`,
        accessorKey: `column${i}`,
        size: 150,
      })
    }

    return cols
  }, [])

  return (
    <Box h="500px" w="100%">
      <DataGrid
        instanceRef={gridRef}
        columns={columns}
        data={data}
        columnVirtualizerOptions={{
          enabled: true,
        }}
        focusMode="grid"
        experimental_enableCellSelection
        initialState={{
          columnPinning: {
            left: ['pinnedColumn'],
          },
        }}
      />
    </Box>
  )
}

export const Translations = {
  args: {
    columns,
    data,
    initialState,
    children: <Pagination />,
    translations: {
      page: 'Pagina',
      of: 'van {pageCount}',
      nextPage: 'Volgende pagina',
      previousPage: 'Vorige pagina',
      expandRows: 'Alle rijen uitvouwen',
      collapseRows: 'Alle rijen samenvouwen',
      deselectAllRows: 'Alle rijen deselecteren',
      selectAllRows: 'Alle rijen selecteren',
      selectRow: 'Rij selecteren',
      deselectRow: 'Rij deselecteren',
      sortAscending: 'Oplopend sorteren',
      sortDescending: 'Aflopend sorteren',
    },
  },
}
