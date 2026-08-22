import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: true,
  description: 'Drawer with a form to add a new contact',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Drawers',
  canvas: {
    center: true,
    height: '800px',
  },
} satisfies RegistryItemConfig
