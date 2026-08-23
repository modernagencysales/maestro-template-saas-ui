import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

import {
  assertProductionAuthConfiguration,
  resolveWebAuthMode,
} from "./src/lib/auth/runtime-auth";

process.env.VITE_MAESTRO_AUTH_MODE = resolveWebAuthMode(process.env);
assertProductionAuthConfiguration(process.env);

export default defineConfig(({ mode }) => ({
  build: { sourcemap: false },
  esbuild: { drop: ["console"] },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@maestro-template/convex/refs": fileURLToPath(
        new URL("../../packages/convex/src/refs.ts", import.meta.url),
      ),
    },
  },
  plugins: [
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
    nitro(),
  ],
  server: {
    port: 3000,
    allowedHosts: process.env.NODE_ENV === "development" ? true : undefined,
  },
}));
