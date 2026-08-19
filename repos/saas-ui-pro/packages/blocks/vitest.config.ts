import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '#registry/default': path.resolve(
        import.meta.dirname,
        '../registry/public/source',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['lists/**/*.test.{ts,tsx}', 'sidebar-layouts/**/*.test.{ts,tsx}'],
  },
})
