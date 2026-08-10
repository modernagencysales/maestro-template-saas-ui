import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/components/color-mode.tsx.
export const appearancePreferences = ["light", "dark", "system"] as const;
export type AppearancePreference = (typeof appearancePreferences)[number];
export type ResolvedAppearance = Exclude<AppearancePreference, "system">;

export const normalizeAppearancePreference = (
  value: string | undefined,
): AppearancePreference =>
  appearancePreferences.find((preference) => preference === value) ?? "system";

export const resolveAppearance = (
  preference: AppearancePreference,
  systemIsDark: boolean,
): ResolvedAppearance =>
  preference === "system" ? (systemIsDark ? "dark" : "light") : preference;

export function ColorModeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableColorScheme
      enableSystem
      storageKey="maestro-appearance"
    >
      {children}
    </ThemeProvider>
  );
}

export function useColorMode() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  return {
    appearance: normalizeAppearancePreference(theme),
    resolvedAppearance: resolvedTheme === "dark" ? "dark" : "light",
    setAppearance: (appearance: AppearancePreference) => setTheme(appearance),
  } as const;
}
