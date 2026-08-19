import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: true,
  description: 'A task card with labels',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Cards',
  canvas: {
    center: true,
    maxWidth: '380px',
  },
} satisfies RegistryItemConfig
