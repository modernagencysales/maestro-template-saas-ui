import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppearanceMenu, appearanceOptions } from "./appearance-menu";
import {
  ColorModeProvider,
  normalizeAppearancePreference,
  resolveAppearance,
} from "./color-mode";
import { MaestroSaasUiProvider } from "./provider";

describe("appearance foundation", () => {
  it("defaults an absent or invalid preference to system", () => {
    expect(normalizeAppearancePreference(undefined)).toBe("system");
    expect(normalizeAppearancePreference("sepia")).toBe("system");
    expect(normalizeAppearancePreference("light")).toBe("light");
    expect(normalizeAppearancePreference("dark")).toBe("dark");
  });

  it("resolves system against the current operating-system appearance", () => {
    expect(resolveAppearance("system", true)).toBe("dark");
    expect(resolveAppearance("system", false)).toBe("light");
    expect(resolveAppearance("light", true)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
  });

  it("exposes the closed Light, Dark, and System menu contract", () => {
    expect(appearanceOptions).toEqual([
      { label: "Light", value: "light" },
      { label: "Dark", value: "dark" },
      { label: "System", value: "system" },
    ]);
  });

  it("renders an accessible keyboard-managed radio menu", () => {
    const html = renderToStaticMarkup(
      <ColorModeProvider>
        <MaestroSaasUiProvider>
          <AppearanceMenu defaultOpen />
        </MaestroSaasUiProvider>
      </ColorModeProvider>,
    );

    expect(html).toContain("Appearance");
    expect(html).toContain('role="menuitemradio"');
    for (const option of appearanceOptions) {
      expect(html).toContain(option.label);
    }
  });

  it("emits the pre-hydration script without a server render warning", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      <ColorModeProvider>
        <div>Direct navigation</div>
      </ColorModeProvider>,
    );

    expect(html).toContain("localStorage");
    expect(html).toContain("matchMedia");
    expect(html).toContain("system");
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
