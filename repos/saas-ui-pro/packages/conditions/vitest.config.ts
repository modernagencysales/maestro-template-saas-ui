import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import path from 'path'
import tsconfigpaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tsconfigpaths()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', '@zag-js/react'],
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    alias: [{ find: /^#/, replacement: path.resolve(__dirname, './src/') }],
  },
})
