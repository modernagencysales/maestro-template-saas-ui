export type TemplateStylesheetLink = {
  readonly rel: "stylesheet";
  readonly href: string;
};

export type TemplateRouteHeadOptions = {
  readonly title?: string;
  readonly description?: string;
  readonly path?: string;
  readonly stylesheets?: readonly TemplateStylesheetLink[];
};

const siteName = "Maestro Template";
const siteUrl = "https://maestro-template.pages.dev";
const defaultDescription =
  "Private app factory for B2B AI Brain, workflow, and agent software.";

const canonicalUrl = (path: string | undefined): string =>
  `${siteUrl}${path?.startsWith("/") ? path : "/"}`;

export const buildTemplateRouteHead = ({
  description = defaultDescription,
  path,
  stylesheets = [],
  title = siteName,
}: TemplateRouteHeadOptions = {}) => {
  const canonical = canonicalUrl(path);

  return {
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title },
      { name: "description", content: description },
      { name: "application-name", content: siteName },
      { property: "og:site_name", content: siteName },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: `${siteUrl}/social-card.svg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${siteUrl}/social-card.svg` },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      ...stylesheets,
    ],
  };
};
