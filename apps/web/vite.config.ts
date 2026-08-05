import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { dependencyChunkName } from "./src/bundle-policy";

const contractsApiBaseUrl = process.env.MAESTRO_API_BASE_URL?.trim();
const contractsApiKey = process.env.MAESTRO_API_KEY?.trim();

export default defineConfig({
  preview: { host: "127.0.0.1" },
  ...(contractsApiBaseUrl && contractsApiKey
    ? {
        server: {
          proxy: {
            "/__contracts": {
              target: contractsApiBaseUrl,
              headers: { authorization: `Bearer ${contractsApiKey}` },
              rewrite: (path: string) => path.replace(/^\/__contracts/u, ""),
            },
          },
        },
      }
    : {}),
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: dependencyChunkName,
            },
          ],
        },
      },
    },
    sourcemap: false,
  },
  plugins: [
    tanstackStart({
      server: { entry: "server.ts" },
      spa: {
        enabled: true,
        prerender: {
          retryCount: 2,
          retryDelay: 500,
        },
      },
      router: {
        routesDirectory: "./routes",
        generatedRouteTree: "./routeTree.gen.ts",
      },
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@maestro-template/template-core/generated/confectManifest":
        fileURLToPath(
          new URL(
            "../../packages/template-core/src/generated/confectManifest.ts",
            import.meta.url,
          ),
        ),
      "@maestro-template/template-core/workflow-semantics": fileURLToPath(
        new URL(
          "../../packages/template-core/src/workflow-semantics/contract.ts",
          import.meta.url,
        ),
      ),
      "@maestro-template/ui": fileURLToPath(
        new URL("../../packages/ui/src/index.tsx", import.meta.url),
      ),
      "@maestro-template/convex/refs": fileURLToPath(
        new URL("../../packages/convex/src/refs.ts", import.meta.url),
      ),
      "@maestro-template/template-core": fileURLToPath(
        new URL("../../packages/template-core/src/index.ts", import.meta.url),
      ),
      "@maestro-template/notifications": fileURLToPath(
        new URL("../../packages/notifications/src/index.ts", import.meta.url),
      ),
      "@maestro-template/workflow-ui/workflowCanvasState": fileURLToPath(
        new URL(
          "../../packages/workflow-ui/src/workflowCanvasState.ts",
          import.meta.url,
        ),
      ),
      "@maestro-template/workflow-ui": fileURLToPath(
        new URL("../../packages/workflow-ui/src/index.tsx", import.meta.url),
      ),
    },
  },
});
