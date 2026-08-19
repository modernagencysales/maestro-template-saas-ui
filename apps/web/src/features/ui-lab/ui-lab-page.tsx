/* eslint-disable template/saas-ui-semantic-colors -- the UI lab preserves the pinned Pro Storybook compositions verbatim. */
import * as React from 'react'

import {
  Badge,
  Box,
  Button,
  IconButton,
  Portal,
  Skeleton,
  SkeletonText,
  Stack,
  Text,
  VisuallyHidden,
} from '@chakra-ui/react'
import {
  ActiveFiltersList,
  DataGrid,
  type DataGridCell,
  type FilterItem,
  FilterMenu,
  FiltersProvider,
  SplitPage,
  type ColumnDef,
  useFiltersContext,
} from '@saas-ui-pro/react'
import { SaasUILogo } from '@saas-ui/assets'
import { Page } from '@saas-ui/react'
import { Link } from '@tanstack/react-router'
import { LuEllipsisVertical, LuHouse, LuSettings, LuUsers } from 'react-icons/lu'

import * as DemoGridList from '#components/ui/grid-list/grid-list'
import * as DemoMenu from '#components/ui/menu/menu'
import * as DemoPage from '#components/ui/page/page'
import * as DemoSidebar from '#components/ui/sidebar/sidebar'
import { AppShell } from '#components/ui/app-shell/app-shell'
import { Avatar } from '#components/ui/avatar/avatar'
import { NavbarBranded } from '#components/navbar-branded/navbar-branded'
import { NavbarTabs } from '#components/navbar-tabs/navbar-tabs'
import { Sidebar1 } from '#components/sidebar1/sidebar1'
import { Sidebar2 } from '#components/sidebar2/sidebar2'
import { Sidebar3 } from '#components/sidebar3/sidebar3'
import {
  SortableNavGroup,
  SortableNavItem,
} from '#components/sidebar4/sidebar4'

import { KanbanDemo } from './kanban-demo'
import { WriterDemo } from './writer-demo'

export const uiLabDemos = [
  { id: 'writer', label: 'Writer' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'data-grid', label: 'DataGrid' },
  { id: 'filters', label: 'Filters' },
  { id: 'split-page', label: 'SplitPage' },
  { id: 'sidebar-1', label: 'Sidebar 1' },
  { id: 'sidebar-2', label: 'Sidebar 2' },
  { id: 'sidebar-3', label: 'Sidebar 3' },
  { id: 'sidebar-4', label: 'Sidebar 4' },
  { id: 'navbar-branded', label: 'Branded nav' },
  { id: 'navbar-tabs', label: 'Tabbed nav' },
] as const

type DemoId = (typeof uiLabDemos)[number]['id']

export function UiLabPage({ demo }: { demo: string }) {
  const selected = uiLabDemos.some((item) => item.id === demo)
    ? (demo as DemoId)
    : 'writer'

  return (
    <Page.Root minH="100dvh" bg="bg.muted">
      <Page.Header
        title="Saas UI Pro UI Lab"
        description="Pinned, preassembled demo compositions"
        actions={
          <Button asChild size="xs" variant="surface">
            <Link to="/">Back to app</Link>
          </Button>
        }
      />
      <Box
        display="flex"
        gap="2"
        px="4"
        py="3"
        overflowX="auto"
        borderBottomWidth="1px"
        bg="bg.panel"
      >
        {uiLabDemos.map((item) => (
          <Button
            key={item.id}
            asChild
            size="xs"
            variant={selected === item.id ? 'solid' : 'surface'}
            flexShrink="0"
          >
            <Link to="/ui-lab/$demo" params={{ demo: item.id }}>
              {item.label}
            </Link>
          </Button>
        ))}
      </Box>
      <Page.Body p="0" maxW="none" overflow="auto">
        <Demo selected={selected} />
      </Page.Body>
    </Page.Root>
  )
}

const demoComponents: Record<DemoId, React.ComponentType> = {
  writer: WriterDemo,
  kanban: KanbanDemo,
  'data-grid': DataGridDemo,
  filters: FiltersDemo,
  'split-page': SplitPageDemo,
  'sidebar-1': Sidebar1,
  'sidebar-2': Sidebar2Demo,
  'sidebar-3': Sidebar3Demo,
  'sidebar-4': Sidebar4Demo,
  'navbar-branded': NavbarBrandedDemo,
  'navbar-tabs': NavbarTabsDemo,
}

function Demo({ selected }: { selected: DemoId }) {
  const SelectedDemo = demoComponents[selected]

  return <SelectedDemo />
}

function Sidebar2Demo() {
  return (
    <Sidebar2>
      <Box minH="full" bg="bg" />
    </Sidebar2>
  )
}

function Sidebar3Demo() {
  return (
    <Sidebar3>
      <DemoPage.Root>
        <DemoPage.Header title="Overview" />
      </DemoPage.Root>
    </Sidebar3>
  )
}

function NavbarBrandedDemo() {
  return (
    <NavbarBranded>
      <PrototypeBody title="Contacts" />
    </NavbarBranded>
  )
}

function NavbarTabsDemo() {
  return (
    <NavbarTabs>
      <PrototypeBody />
    </NavbarTabs>
  )
}

type ExampleData = {
  id: string
  firstName: string
  phone: string
  email: string
  address: string
  revenue: number
  status: 'new' | 'active' | 'inactive'
}

const data: ExampleData[] = [
  {
    id: '1',
    firstName: 'TaShya Charles',
    phone: '(651) 467-2240',
    email: 'tashya@example.com',
    address: 'Hudson Street, New York, 10013',
    revenue: 820,
    status: 'new',
  },
  {
    id: '2',
    firstName: 'Donovan Mosley',
    phone: '(154) 698-4775',
    email: 'donovan@example.com',
    address: 'Market Street, San Francisco, 94105',
    revenue: 640,
    status: 'active',
  },
  {
    id: '3',
    firstName: 'Quynn Moore',
    phone: '1-362-643-1030',
    email: 'quynn@example.com',
    address: 'Congress Avenue, Austin, 78701',
    revenue: 410,
    status: 'inactive',
  },
  {
    id: '4',
    firstName: 'Hashim Huff',
    phone: '(202) 481-9204',
    email: 'hashim@example.com',
    address: 'Pine Street, Seattle, 98101',
    revenue: 930,
    status: 'active',
  },
]

const statusLabels = {
  new: 'New',
  active: 'Active',
  inactive: 'Inactive',
}

const StatusCell: DataGridCell<ExampleData> = (cell) => (
  <Box>{statusLabels[cell.getValue<keyof typeof statusLabels>()]}</Box>
)

const ActionCell: DataGridCell<ExampleData> = () => (
  <Stack
    onClick={(event) => event.stopPropagation()}
    alignItems="flex-end"
    width="full"
  >
    <DemoMenu.Root>
      <DemoMenu.Trigger asChild>
        <IconButton
          aria-label="Actions"
          size="xs"
          variant="ghost"
          colorPalette="gray"
        >
          <LuEllipsisVertical />
        </IconButton>
      </DemoMenu.Trigger>
      <Portal>
        <DemoMenu.Content>
          <DemoMenu.Item value="delete">Delete</DemoMenu.Item>
        </DemoMenu.Content>
      </Portal>
    </DemoMenu.Root>
  </Stack>
)

const dataGridColumns: ColumnDef<ExampleData>[] = [
  { accessorKey: 'firstName', header: 'Name' },
  { accessorKey: 'phone', header: 'Phone', meta: { isNumeric: true } },
  { accessorKey: 'email', header: 'Email', size: 300 },
  { accessorKey: 'address', header: 'Address' },
  { accessorKey: 'revenue', header: 'Revenue' },
  { accessorKey: 'status', header: 'Status', cell: StatusCell },
  {
    id: 'action',
    header: () => <VisuallyHidden>Actions</VisuallyHidden>,
    cell: ActionCell,
    size: 50,
    enableSorting: false,
    enableResizing: false,
    meta: { cellProps: { py: 0 } },
  },
]

function DataGridDemo() {
  return (
    <Box minH="640px" bg="bg.panel" p="6">
      <DataGrid<ExampleData>
        columns={dataGridColumns}
        data={data}
        initialState={{ columnVisibility: { phone: false } }}
      />
    </Box>
  )
}

const StatusBadge = (props: React.ComponentProps<typeof Badge>) => (
  <Badge
    boxSize="12px"
    padding="0"
    borderRadius="full"
    variant="outline"
    bg="transparent"
    borderWidth="2px"
    boxShadow="none"
    minH="auto"
    p="0"
    {...props}
  />
)

const filters: FilterItem[] = [
  {
    id: 'status',
    label: 'Status',
    icon: <StatusBadge borderColor="currentColor" />,
    items: [
      {
        id: 'new',
        label: 'New',
        icon: <StatusBadge borderColor="blue.400" />,
      },
      {
        id: 'active',
        label: 'Active',
        icon: <StatusBadge borderColor="green.400" />,
      },
    ],
  },
  {
    id: 'type',
    label: 'Contact is lead',
    activeLabel: 'Contact',
    icon: <LuUsers />,
    value: 'lead',
  },
]

function FiltersDemo() {
  return (
    <FiltersProvider filters={filters}>
      <Box minH="640px" bg="bg.panel" p="6">
        <Stack alignItems="flex-start">
          <FilterAddButton />
          <ActiveFiltersList
            py="2"
            borderBottomWidth="1px"
            zIndex="2"
          />
        </Stack>
      </Box>
    </FiltersProvider>
  )
}

function FilterAddButton() {
  const { enableFilter } = useFiltersContext()
  return (
    <FilterMenu
      items={filters}
      onSelect={(item) => {
        if (Array.isArray(item)) return
        return enableFilter({
          id: item.id,
          operator: item.defaultOperator,
          value: item.value,
        })
      }}
      buttonProps={{ variant: 'surface', size: 'sm' }}
    />
  )
}

const SplitList = () => (
  <DemoGridList.Root>
    <DemoGridList.Item>
      <DemoGridList.Cell width="14">
        <Avatar name="Elliot Alderson" size="sm" />
      </DemoGridList.Cell>
      <DemoGridList.Cell flex="1">
        <Text fontWeight="bold">A bug is never just a mistake.</Text>
        <Text fontSize="sm" color="fg.muted" lineClamp={2}>
          <Text as="span" color="fg">
            Elliot Alderson
          </Text>{' '}
          — It represents something bigger. An error of thinking that makes you
          who you are.
        </Text>
      </DemoGridList.Cell>
    </DemoGridList.Item>
    <DemoGridList.Item>
      <DemoGridList.Cell width="14">
        <Avatar name="Tyrell Wellick" size="sm" />
      </DemoGridList.Cell>
      <DemoGridList.Cell flex="1">
        <Text fontWeight="bold">Hi</Text>
        <Text fontSize="sm" color="fg.muted" lineClamp={2}>
          <Text as="span" color="fg">
            Tyrell Wellick
          </Text>{' '}
          — Unfortunately, we’re all human. Except me, of course.
        </Text>
      </DemoGridList.Cell>
    </DemoGridList.Item>
  </DemoGridList.Root>
)

function SplitPageDemo() {
  return (
    <AppShell borderWidth="1px" height="640px">
      <SplitPage>
        <DemoPage.Root borderRightWidth="1px" width="30%" maxW="300px">
          <DemoPage.Header title="Inbox" />
          <DemoPage.Body p="0">
            <SplitList />
          </DemoPage.Body>
        </DemoPage.Root>
        <DemoPage.Root>
          <DemoPage.Header
            title="Elliot Alderson"
            description="A bug is never just a mistake"
          />
          <DemoPage.Body>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce
              sed nibh sit amet nulla ultricies vehicula. Proin consequat
              auctor vestibulum. Phasellus sit amet fringilla erat, nec
              placerat dui. In iaculis ex non lacus dictum pellentesque.
            </Text>
          </DemoPage.Body>
        </DemoPage.Root>
      </SplitPage>
    </AppShell>
  )
}

const tags = [
  { id: 'lead', name: 'Lead', count: 83, color: 'purple.500' },
  { id: 'customer', name: 'Customer', count: 210, color: 'green.500' },
  { id: 'partner', name: 'Partner', count: 12, color: 'blue.500' },
  { id: 'prospect', name: 'Prospect', count: 0 },
]

function Sidebar4Demo() {
  const [sortedTags, setTags] = React.useState(tags)
  return (
    <AppShell
      height="640px"
      bg="bg"
      sidebar={
        <DemoSidebar.Provider>
          <DemoSidebar.Root>
            <DemoSidebar.Header>
              <SaasUILogo width="100px" />
            </DemoSidebar.Header>
            <DemoSidebar.Body flex="1" overflowY="auto">
              <DemoSidebar.Group>
                <DemoSidebar.NavItem>
                  <DemoSidebar.NavButton asChild>
                    <a href="#">
                      <LuHouse size="1.2em" /> Home
                    </a>
                  </DemoSidebar.NavButton>
                </DemoSidebar.NavItem>
                <DemoSidebar.NavItem>
                  <DemoSidebar.NavButton asChild active>
                    <a href="#">
                      <LuUsers size="1.2em" /> Contacts
                    </a>
                  </DemoSidebar.NavButton>
                </DemoSidebar.NavItem>
                <DemoSidebar.NavItem>
                  <DemoSidebar.NavButton asChild>
                    <a href="#">
                      <LuSettings size="1.2em" /> Settings
                    </a>
                  </DemoSidebar.NavButton>
                </DemoSidebar.NavItem>
              </DemoSidebar.Group>
              <DemoSidebar.Group>
                <DemoSidebar.GroupHeader>
                  <DemoSidebar.GroupTitle>Tags</DemoSidebar.GroupTitle>
                </DemoSidebar.GroupHeader>
                <SortableNavGroup items={sortedTags} onSorted={setTags}>
                  {sortedTags.map((tag) => (
                    <SortableNavItem key={tag.id} id={tag.id}>
                      <DemoSidebar.NavButton>
                        <Box
                          bg={tag.color || 'gray.500'}
                          boxSize="2"
                          borderRadius="full"
                        />
                        <Text>{tag.name}</Text>
                        <Badge
                          opacity="0.6"
                          borderRadius="full"
                          bg="none"
                          ms="auto"
                          fontWeight="medium"
                          colorPalette="neutral"
                        >
                          {tag.count}
                        </Badge>
                      </DemoSidebar.NavButton>
                    </SortableNavItem>
                  ))}
                </SortableNavGroup>
              </DemoSidebar.Group>
            </DemoSidebar.Body>
          </DemoSidebar.Root>
        </DemoSidebar.Provider>
      }
    >
      <DemoPage.Root>
        <DemoPage.Header title="Overview" />
        <DemoPage.Body />
      </DemoPage.Root>
    </AppShell>
  )
}

function PrototypeBody({ title }: { title?: string }) {
  return (
    <DemoPage.Root>
      {title ? <DemoPage.Header title={title} /> : null}
      <DemoPage.Body overflow="visible">
        <Stack gap="4" mb="14" pt="10">
          <Skeleton width="100px" height="24px" />
          <SkeletonText />
        </Stack>
        {[0, 1, 2].map((row) => (
          <Stack key={row} direction="row" gap="8" mb="14">
            <Stack gap="4" flex="1">
              <Skeleton width="100px" height="20px" />
              <SkeletonText />
            </Stack>
            <Stack gap="4" flex="1">
              <Skeleton width="100px" height="20px" />
              <SkeletonText />
            </Stack>
          </Stack>
        ))}
      </DemoPage.Body>
    </DemoPage.Root>
  )
}
