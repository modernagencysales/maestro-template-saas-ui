import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: false,
  description: 'Sidebar with sortable nav group.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Layouts',
  dependencyVersions: {
    '@dnd-kit/core': '^6.3.1',
    '@dnd-kit/sortable': '^10.0.0',
    '@dnd-kit/utilities': '^3.2.2',
  },
  canvas: {
    center: true,
  },
} satisfies RegistryItemConfig
