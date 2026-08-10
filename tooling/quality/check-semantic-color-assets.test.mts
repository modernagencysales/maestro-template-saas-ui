import { describe, expect, it } from "vitest";

import {
  inspectAuthoredCss,
  inspectManifest,
  inspectSvg,
} from "./check-semantic-color-assets.mts";

describe("semantic color asset inspection", () => {
  it("accepts semantic CSS declarations and rejects raw authored colors", () => {
    expect(
      inspectAuthoredCss(
        ":root { color: var(--chakra-colors-fg); background: currentColor; display: flex; }",
        "app.css",
      ),
    ).toEqual([]);
    expect(inspectAuthoredCss(".card { color: #fff; }", "app.css")).toEqual([
      expect.objectContaining({ path: "app.css", value: "#fff" }),
    ]);
    expect(
      inspectAuthoredCss(".card { color: rebeccapurple; }", "app.css"),
    ).toEqual([
      expect.objectContaining({ path: "app.css", value: "rebeccapurple" }),
    ]);
    expect(
      inspectAuthoredCss(
        ".card { background: linear-gradient(var(--chakra-colors-bg), rebeccapurple); }",
        "app.css",
      ),
    ).toEqual([
      expect.objectContaining({ path: "app.css", value: expect.any(String) }),
    ]);
  });

  it("parses manifest color fields instead of scanning arbitrary strings", () => {
    expect(
      inspectManifest(
        JSON.stringify({
          name: "#fff is documentation",
          theme_color: "currentColor",
        }),
        "manifest.webmanifest",
      ),
    ).toEqual([]);
    expect(
      inspectManifest(
        JSON.stringify({ name: "App", background_color: "#ffffff" }),
        "manifest.webmanifest",
      ),
    ).toEqual([
      expect.objectContaining({
        path: "manifest.webmanifest",
        field: "background_color",
        value: "#ffffff",
      }),
    ]);
  });

  it("checks exact SVG paint attributes", () => {
    expect(
      inspectSvg(
        '<svg fill="currentColor"><path stroke="none" /></svg>',
        "icon.svg",
      ),
    ).toEqual([]);
    expect(
      inspectSvg('<svg><path fill="#111111" /></svg>', "icon.svg"),
    ).toEqual([
      expect.objectContaining({
        path: "icon.svg",
        attribute: "fill",
        value: "#111111",
      }),
    ]);
  });
});
