import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: true,
  description:
    'A card that displays a list of files with an icon, name, size, and modified date',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'Files',
  canvas: {
    center: true,
  },
} satisfies RegistryItemConfig
