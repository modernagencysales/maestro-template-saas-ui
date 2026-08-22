import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: false,
  description: 'A card for displaying an integration.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Settings',
  canvas: {
    center: true,
    maxWidth: '4xl',
  },
} satisfies RegistryItemConfig
