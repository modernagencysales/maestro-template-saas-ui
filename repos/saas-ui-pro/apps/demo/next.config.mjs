import { URL, fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../../../..', import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@saas-ui/date-picker', '@saas-ui-pro/react'],
  turbopack: {
    root: workspaceRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
