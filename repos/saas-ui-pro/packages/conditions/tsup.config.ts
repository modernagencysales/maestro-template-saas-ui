import { defineConfig } from 'tsup'

export default defineConfig({
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  entry: [
    'src/index.ts',
    'src/components/**/index.ts',
    'src/hooks/index.ts',
    'src/utils/index.ts',
  ],
  dts: {
    resolve: true,
  },
  clean: true,
  sourcemap: false,
  external: ['react', '@tanstack/react-table', '@chakra-ui/react'],
  format: ['esm', 'cjs'],
  banner: {
    js: "'use client'",
  },
})
