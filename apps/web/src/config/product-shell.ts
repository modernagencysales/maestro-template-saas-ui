export const productShell = {
  navigation: {
    dashboard: { label: 'Dashboard', to: '/$workspace' },
    inbox: { label: 'Inbox', to: '/$workspace/inbox' },
    contacts: { label: 'Contacts', to: '/$workspace/contacts' },
    kanban: { label: 'Kanban', to: '/$workspace/kanban' },
    showcase: { label: 'Showcase', to: '/$workspace/showcase' },
  },
  labels: {
    contacts: 'Contacts',
    inbox: 'Inbox',
  },
  dashboard: 'reports' as 'reports' | 'connections',
  inbox: 'contacts' as 'contacts' | 'brain',
  contacts: 'contacts' as 'contacts' | 'clients',
  search: 'workspace' as 'workspace' | 'assistant',
} as const
