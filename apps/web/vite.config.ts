import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { dependencyChunkName } from "./src/bundle-policy";

const contractsApiBaseUrl = process.env.MAESTRO_API_BASE_URL?.trim();
const contractsApiKey = process.env.MAESTRO_API_KEY?.trim();

const isSafeContractsApiBaseUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" ||
          url.hostname === "[::1]" ||
          url.hostname === "::1" ||
          /^127(?:\.\d{1,3}){3}$/u.test(url.hostname)))
    );
  } catch {
    return false;
  }
};

if (
  contractsApiBaseUrl &&
  contractsApiKey &&
  !isSafeContractsApiBaseUrl(contractsApiBaseUrl)
) {
  throw new Error("MAESTRO_API_BASE_URL must use HTTPS or loopback HTTP.");
}

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
              name: "vendor-backend",
              priority: 100,
              test: (moduleId: string) =>
                dependencyChunkName(moduleId) === "vendor-backend",
              includeDependenciesRecursively: true,
            },
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
    dedupe: ["react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
      "@workspace/ui": fileURLToPath(
        new URL("./src/components", import.meta.url),
      ),
      "@workspace/api": fileURLToPath(
        new URL("./src/workspace/api", import.meta.url),
      ),
      "@workspace/i18n": fileURLToPath(
        new URL("./src/workspace/i18n/index.ts", import.meta.url),
      ),
      "@workspace/config": fileURLToPath(
        new URL("./src/workspace/config/index.ts", import.meta.url),
      ),
      "@workspace/better-auth": fileURLToPath(
        new URL("./src/workspace/better-auth", import.meta.url),
      ),
    },
  },
});
