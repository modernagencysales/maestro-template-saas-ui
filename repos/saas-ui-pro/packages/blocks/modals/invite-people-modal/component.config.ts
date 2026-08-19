import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: true,
  description: 'A modal for inviting people to a workspace.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Modals',
  canvas: {
    center: true,
    height: '500px',
  },
} satisfies RegistryItemConfig
