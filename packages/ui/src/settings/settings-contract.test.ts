import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("local settings boundary contract", () => {
  it("implements settings primitives locally through packages/ui", () => {
    const settings = read("src/settings/template-settings-panel.tsx");

    expect(settings).not.toContain("@notion-kit");
    expect(settings).toContain("TemplateSettingsAdapters");
    expect(settings).toContain("createTemplateSettingsMockAdapters");
    expect(settings).toContain("TemplateSettingsPanel");
    expect(settings).toContain("template-settings-panel");
    expect(settings).toContain("template-settings-sidebar");
  });

  it("exports the settings adapter from the public UI package surface", () => {
    const packageJson = read("package.json");

    expect(packageJson).toContain('"./settings"');
    expect(packageJson).toContain(
      "./dist/src/settings/template-settings-panel.js",
    );
  });
});
