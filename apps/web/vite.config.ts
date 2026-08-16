import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  build: { sourcemap: false },
  esbuild: { drop: ["console"] },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@maestro-template/convex/refs": fileURLToPath(
        new URL("../../packages/convex/src/refs.ts", import.meta.url),
      ),
    },
  },
  plugins: [
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    react(),
    nitro(),
  ],
  server: {
    port: 3000,
    allowedHosts: process.env.NODE_ENV === "development" ? true : undefined,
  },
});
