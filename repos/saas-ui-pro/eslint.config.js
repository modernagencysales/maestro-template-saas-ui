// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import storybook from 'eslint-plugin-storybook'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': [
        'warn',
        {
          allowSingleExtends: true,
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/router',
              message: 'Please import from next/navigation instead.',
            },
          ],
        },
      ],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
    ignores: [
      '**/.next',
      '**/_next',
      '**/next.config.js',
      '**/next.config.mjs',
      '**/nextron.config.js',
      '**/generated',
      '**/*.generated.*',
      '**/*.graphql.d.ts',
      '**/*.graphqls.d.ts',
      '**/dist',
      'apps/desktop/app',
      'examples/**/*',
      'packages/cli/lib',
      '**/*.stories.tsx',
    ],
  },
  ...storybook.configs['flat/recommended'],
)
