export const seo = ({
  title = "Saas.js Tanstack Start",
  description = "Build better SaaS apps with Saas.js Tanstack Start",
  keywords = "tanstack, saas, ui, react, typescript, trpc",
  image = "",
} = {}) => {
  const tags = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:creator", content: "@saas_js" },
    { name: "twitter:site", content: "@saas_js" },
    { name: "og:type", content: "website" },
    { name: "og:title", content: title },
    { name: "og:description", content: description },
    ...(image
      ? [
          { name: "twitter:image", content: image },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "og:image", content: image },
        ]
      : []),
  ];

  return tags;
};
