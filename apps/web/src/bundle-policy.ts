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

export const dependencyChunkName = (moduleId: string): string | null => {
  const packageName = packageNameFromModuleId(moduleId);
  if (packageName === null) return null;

  if (belongsTo(packageName, ["react", "react-dom", "scheduler"])) {
    return "vendor-react";
  }
  if (
    belongsTo(packageName, [
      "@ark-ui",
      "@chakra-ui",
      "@emotion",
      "@saas-ui",
      "framer-motion",
      "lucide-react",
    ])
  ) {
    return "vendor-ui";
  }
  if (
    belongsTo(packageName, [
      "@blocknote",
      "@tiptap",
      "lib0",
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-transform",
      "prosemirror-view",
      "y-prosemirror",
      "yjs",
    ])
  ) {
    return "vendor-editor";
  }
  if (belongsTo(packageName, ["@xyflow", "d3"])) {
    return "vendor-graph";
  }
  if (belongsTo(packageName, ["@tanstack"])) {
    return "vendor-router";
  }
  if (belongsTo(packageName, ["@confect", "effect"])) {
    return "vendor-effect";
  }
  if (belongsTo(packageName, ["@convex-dev", "@workos", "convex"])) {
    return "vendor-backend";
  }
  return "vendor";
};
