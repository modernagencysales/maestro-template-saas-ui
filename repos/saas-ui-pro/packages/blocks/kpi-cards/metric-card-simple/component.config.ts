import type { RegistryItemConfig } from '@saas-ui/registry/compiler'

export default {
  private: true,
  description:
    'A metric card that displays a KPI metric with a label, value and difference.',
  version: '1.1.0',
  category: 'Application',
  subcategory: 'KPI Cards',
  canvas: {
    center: true,
  },
} satisfies RegistryItemConfig
