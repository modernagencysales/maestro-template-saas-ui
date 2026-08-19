import { platformSelect } from '@saas-ui-pro/react'

import { type HotkeysConfig } from '#features/common/lib/hotkeys'

export const appHotkeys = {
  general: {
    title: 'General',
    hotkeys: {
      help: {
        label: 'Help & support',
        hotkey: { key: '?' },
      },
      search: {
        label: 'Search',
        hotkey: '/',
      },
      filter: {
        label: 'Add filter',
        hotkey: 'F',
      },
      logout: {
        label: 'Log out',
        hotkey: platformSelect({ mac: 'Alt+Shift+Q' }, 'Control+Shift+Q'),
      },
    },
  },
  navigation: {
    title: 'Navigation',
    hotkeys: {
      updates: {
        label: 'Go to Updates',
        hotkey: ['G', 'U'],
      },
      people: {
        label: 'Go to People',
        hotkey: ['G', 'P'],
      },
      companies: {
        label: 'Go to Companies',
        hotkey: ['G', 'C'],
      },
      workflows: {
        label: 'Go to Workflows',
        hotkey: ['G', 'W'],
      },
      reports: {
        label: 'Go to Reports',
        hotkey: ['G', 'R'],
      },
    },
  },
  contacts: {
    title: 'Contacts',
    hotkeys: {
      add: {
        label: 'Add a person',
        hotkey: 'A',
      },
    },
  },
  settings: {
    hotkeys: {
      close: {
        label: 'Close settings',
        hotkey: 'Escape',
      },
    },
  },
} satisfies HotkeysConfig
