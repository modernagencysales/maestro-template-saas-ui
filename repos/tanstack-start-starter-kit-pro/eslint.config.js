// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import storybook from 'eslint-plugin-storybook'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
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
    },
  },
  {
    ignores: [
      '**/.output/',
      '**/.tanstack/',
      '**/routeTree.gen.ts',
      '**/vite.config.*',
      '**/generated/',
      '**/*.generated.*',
      '**/dist/',
      '.prettierrc.cjs',
      'lint-staged.config.cjs',
      'eslint.config.js',
      '**/.storybook/',
    ],
  },
  storybook.configs['flat/recommended'],
)
