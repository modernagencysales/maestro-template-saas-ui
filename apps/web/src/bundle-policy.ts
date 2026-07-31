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
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-transform",
      "prosemirror-view",
      "y-prosemirror",
      "yjs",
    ],
  ],
  ["vendor-graph", ["@xyflow", "d3"]],
  ["vendor-router", ["@tanstack"]],
  ["vendor-effect", ["@confect", "effect"]],
  ["vendor-backend", ["@convex-dev", "@workos", "convex"]],
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
