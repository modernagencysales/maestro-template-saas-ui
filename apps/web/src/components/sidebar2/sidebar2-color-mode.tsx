import * as React from "react";

import {
  DarkMode,
  useColorMode,
} from "@/components/setup/color-mode/color-mode";

/**
 * Keeps this high-contrast sidebar dark without changing the surrounding app.
 * Avoid nesting an extra theme boundary when the app is already in dark mode.
 */
export function SidebarDarkMode({ children }: React.PropsWithChildren) {
  const { colorMode } = useColorMode();

  if (colorMode === "dark") {
    return <>{children}</>;
  }

  return <DarkMode>{children}</DarkMode>;
}
