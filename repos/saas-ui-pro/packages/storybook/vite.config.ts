import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      '#registry/default': path.resolve(
        import.meta.dirname,
        '../registry/public/source',
      ),
      '@/registry/default': path.resolve(
        import.meta.dirname,
        '../registry/public/source',
      ),
    },
    conditions: ['sui-pro', 'main', 'module', 'import'],
  },
})
