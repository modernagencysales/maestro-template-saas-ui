import { describe, expect, it } from "vitest";
import { buildTemplateRouteHead } from "./route-head";

describe("buildTemplateRouteHead", () => {
  it("builds canonical, social, manifest, and icon metadata", () => {
    const head = buildTemplateRouteHead({
      path: "/onboarding",
      stylesheets: [{ rel: "stylesheet", href: "/assets/app.css" }],
    });

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: "Maestro Template" },
        {
          name: "description",
          content:
            "Private app factory for B2B AI Brain, workflow, and agent software.",
        },
        {
          property: "og:url",
          content: "https://maestro-template.pages.dev/onboarding",
        },
        {
          property: "og:image",
          content: "https://maestro-template.pages.dev/social-card.svg",
        },
        { name: "twitter:card", content: "summary_large_image" },
      ]),
    );
    expect(head.meta).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "theme-color" }),
      ]),
    );
    expect(head.links).toEqual(
      expect.arrayContaining([
        {
          rel: "canonical",
          href: "https://maestro-template.pages.dev/onboarding",
        },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "stylesheet", href: "/assets/app.css" },
      ]),
    );
  });
});
