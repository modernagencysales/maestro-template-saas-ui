import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: false,
  description: 'Settings section for managing notifications.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Settings',
  canvas: {
    center: true,
    maxWidth: 'xl',
  },
} satisfies RegistryItemConfig
