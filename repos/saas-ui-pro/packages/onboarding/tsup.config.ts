import { defineConfig } from 'tsup'

export default defineConfig({
  target: 'es2021',
  dts: {
    resolve: true,
  },
  clean: true,
  sourcemap: true,
  external: ['react', '@chakra-ui/anatomy', '@chakra-ui/react'],
  format: ['esm', 'cjs'],
  banner: {
    js: "'use client'",
  },
})
