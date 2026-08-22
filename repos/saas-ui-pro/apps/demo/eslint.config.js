import nextPlugin from '@next/eslint-plugin-next'
import { defineConfig, globalIgnores } from 'eslint/config'

import baseConfig from '../../eslint.config.js'

export default defineConfig(
  globalIgnores(['.next/**', '**/*.stories.tsx']),
  ...baseConfig,
  {
    ...nextPlugin.configs.recommended,
    files: ['**/*.{js,jsx,ts,tsx}'],
    settings: {
      next: {
        rootDir: import.meta.dirname,
      },
    },
  },
)
