import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: false,
  description:
    'A menu that displays the logged in user information and actions.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Menus',
  canvas: {
    center: true,
    height: '480px',
  },
} satisfies RegistryItemConfig
