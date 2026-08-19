import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: true,
  description: 'A list of tasks with drag and drop sorting.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Lists',
  dependencyVersions: {
    '@dnd-kit/core': '^6.3.1',
    '@dnd-kit/modifiers': '^9.0.0',
    '@dnd-kit/sortable': '^10.0.0',
  },
  canvas: {
    center: true,
    height: '400px',
  },
} satisfies RegistryItemConfig
