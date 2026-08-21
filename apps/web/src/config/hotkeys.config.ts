import { platformSelect } from '@saas-ui-pro/react'
import type { HotkeysConfig } from '@saas-ui/use-hotkeys'

export const appHotkeys = {
  general: {
    title: 'General',
    hotkeys: {
      help: {
        label: 'Help & support',
        command: '?',
      },
      search: {
        label: 'Search',
        command: '/',
      },
      filter: {
        label: 'Add filter',
        command: 'F',
      },
      logout: {
        label: 'Log out',
        command: platformSelect({ mac: '⌥ ⇧ Q' }, 'Ctrl+Shift+Q'),
      },
    },
  },
  navigation: {
    title: 'Navigation',
    hotkeys: {
      dashboard: {
        label: 'Go to Dashboard',
        command: 'G then D',
      },
      inbox: {
        label: 'Go to Inbox',
        command: 'G then I',
      },
      contacts: {
        label: 'Go to Contacts',
        command: 'G then C',
      },
      updates: {
        label: 'Go to Updates',
        command: 'G then U',
      },
      people: {
        label: 'Go to People',
        command: 'G then P',
      },
      companies: {
        label: 'Go to Companies',
        command: 'G then O',
      },
      workflows: {
        label: 'Go to Workflows',
        command: 'G then W',
      },
      reports: {
        label: 'Go to Reports',
        command: 'G then R',
      },
      uiLab: {
        label: 'Go to UI Lab',
        command: 'G then L',
      },
    },
  },
  contacts: {
    title: 'Contacts',
    hotkeys: {
      add: {
        label: 'Add a person',
        command: 'A',
      },
    },
  },
  settings: {
    hotkeys: {
      close: {
        label: 'Close settings',
        command: 'Esc',
      },
    },
  },
} satisfies HotkeysConfig
