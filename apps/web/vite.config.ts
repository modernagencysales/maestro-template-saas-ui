import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
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
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      router: {
        enableRouteGeneration:
          mode !== "test" &&
          process.env.MAESTRO_DISABLE_ROUTE_GENERATION !== "1",
      },
      spa: {
        enabled: true,
      },
    }),
    react(),
  ],
  server: {
    port: 3000,
    allowedHosts: process.env.NODE_ENV === "development" ? true : undefined,
  },
}));
