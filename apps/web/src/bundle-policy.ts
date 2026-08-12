const packageNameFromModuleId = (moduleId: string): string | null => {
  const normalized = moduleId.replaceAll("\\", "/");
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const packagePath = normalized.slice(markerIndex + marker.length);
  const segments = packagePath.split("/");
  if (segments[0]?.startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }
  return segments[0] || null;
};

const belongsTo = (packageName: string, owners: readonly string[]): boolean =>
  owners.some(
    (owner) => packageName === owner || packageName.startsWith(`${owner}/`),
  );

const dependencyChunks = [
  ["vendor-react", ["react", "react-dom", "scheduler"]],
  ["vendor-icons", ["react-icons"]],
  ["vendor-charts", ["recharts"]],
  ["vendor-dates", ["date-fns", "@internationalized/date"]],
  ["vendor-dnd", ["@dnd-kit"]],
  ["vendor-saas-pro", ["@saas-ui-pro"]],
  ["vendor-zag", ["@zag-js", "@pandacss/is-valid-prop"]],
  ["vendor-floating", ["@floating-ui"]],
  [
    "vendor-ui",
    [
      "@ark-ui",
      "@chakra-ui",
      "@emotion",
      "@saas-ui",
      "framer-motion",
      "lucide-react",
    ],
  ],
  [
    "vendor-editor",
    [
      "@blocknote",
      "@tiptap",
      "lib0",
      "orderedmap",
      "prosemirror-model",
      "prosemirror-commands",
      "prosemirror-dropcursor",
      "prosemirror-gapcursor",
      "prosemirror-history",
      "prosemirror-keymap",
      "prosemirror-schema-list",
      "prosemirror-state",
      "prosemirror-transform",
      "prosemirror-view",
      "y-prosemirror",
      "yjs",
    ],
  ],
  [
    "vendor-graph",
    [
      "@xyflow",
      "d3",
      "d3-array",
      "d3-color",
      "d3-format",
      "d3-interpolate",
      "d3-path",
      "d3-scale",
      "d3-shape",
      "d3-time",
      "d3-time-format",
      "internmap",
    ],
  ],
  ["vendor-router", ["@tanstack"]],
  ["vendor-effect", ["@confect", "effect"]],
  ["vendor-backend", ["@convex-dev", "@workos", "convex"]],
  [
    "vendor-state",
    ["@reduxjs", "immer", "react-redux", "redux", "redux-thunk", "reselect"],
  ],
  [
    "vendor-runtime",
    [
      "@react-hookz/web",
      "async-channel",
      "clsx",
      "es-toolkit",
      "eventemitter3",
      "fast-equals",
      "hoist-non-react-statics",
      "js-cookie",
      "linkifyjs",
      "motion-dom",
      "motion-utils",
      "next-themes",
      "react-is",
      "slug",
      "tiny-invariant",
      "uint8array-extras",
      "use-sync-external-store",
      "valibot",
      "w3c-keyname",
      "zod",
      "zustand",
    ],
  ],
] as const satisfies readonly (readonly [string, readonly string[]])[];

export const dependencyChunkName = (moduleId: string): string | null => {
  const packageName = packageNameFromModuleId(moduleId);
  if (packageName === null) return null;
  return (
    dependencyChunks.find(([, owners]) =>
      belongsTo(packageName, owners),
    )?.[0] ?? "vendor"
  );
};
