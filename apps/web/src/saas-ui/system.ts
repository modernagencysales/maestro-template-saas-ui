import { createSystem, defineConfig } from "@chakra-ui/react";
import { defaultConfig } from "@saas-ui-pro/react";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/theme/preset.ts. The template intentionally defines no brand palette.
const templateConfig = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: "Inter Variable, ui-sans-serif, system-ui, sans-serif" },
        heading: {
          value: "Inter Variable, ui-sans-serif, system-ui, sans-serif",
        },
      },
    },
    semanticTokens: {
      colors: {
        chart: {
          primary: { value: "{colors.accent.solid}" },
          secondary: { value: "{colors.fg.muted}" },
        },
      },
    },
    textStyles: {
      metric: {
        value: {
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, templateConfig);
