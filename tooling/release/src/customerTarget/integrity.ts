const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const repositoryRoots = [
  "apps/",
  "packages/",
  "tooling/",
  "scripts/",
  "docs/",
  "repos/",
  "agent-patterns/",
  "examples/",
] as const;

export type CustomerTargetIntegrityFinding = {
  readonly code:
    "UNRESOLVED_WORKSPACE_DEPENDENCY" | "MISSING_DOCUMENT_REFERENCE";
  readonly path: string;
  readonly reference: string;
};

export type CustomerTargetFiles = Readonly<
  Record<string, string | Buffer<ArrayBufferLike>>
>;

export function validateCustomerTargetIntegrity(
  files: CustomerTargetFiles,
): readonly CustomerTargetIntegrityFinding[] {
  const paths = new Set(Object.keys(files));
  const packageNames = new Set<string>();
  const packages = new Map<string, Record<string, unknown>>();

  for (const [path, bytes] of Object.entries(files)) {
    if (!path.endsWith("package.json")) continue;
    const manifest = JSON.parse(bytes.toString()) as Record<string, unknown>;
    packages.set(path, manifest);
    if (typeof manifest.name === "string") packageNames.add(manifest.name);
  }

  const findings: CustomerTargetIntegrityFinding[] = [];
  for (const [path, manifest] of packages) {
    for (const section of dependencySections) {
      const dependencies = manifest[section];
      if (!isRecord(dependencies)) continue;
      for (const [name, specifier] of Object.entries(dependencies)) {
        if (
          typeof specifier === "string" &&
          specifier.startsWith("workspace:") &&
          !packageNames.has(name)
        ) {
          findings.push({
            code: "UNRESOLVED_WORKSPACE_DEPENDENCY",
            path,
            reference: name,
          });
        }
      }
    }
  }

  for (const [path, bytes] of Object.entries(files)) {
    if (!isGeneratedInstruction(path)) continue;
    for (const reference of documentReferences(bytes.toString())) {
      if (!paths.has(reference) && !hasDirectory(paths, reference)) {
        findings.push({
          code: "MISSING_DOCUMENT_REFERENCE",
          path,
          reference,
        });
      }
    }
  }

  return [
    ...new Map(
      findings.map((finding) => [findingKey(finding), finding]),
    ).values(),
  ].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path) ||
      left.reference.localeCompare(right.reference),
  );
}

function documentReferences(markdown: string): readonly string[] {
  const tokens = [
    ...markdown.matchAll(/`([^`\n]+)`/g),
    ...markdown.matchAll(/\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g),
  ];
  return tokens
    .map((match) => normalizeReference(match[1] ?? ""))
    .filter(
      (reference) =>
        repositoryRoots.some((root) => reference.startsWith(root)) &&
        reference.endsWith(".md") &&
        !reference.startsWith("docs/template/generated/") &&
        !/[<>{}*]/.test(reference),
    );
}

function normalizeReference(reference: string): string {
  return reference
    .replace(/^\.\//, "")
    .replace(/[?#].*$/, "")
    .replace(/[.,;:]$/, "");
}

function isGeneratedInstruction(path: string): boolean {
  return path.endsWith(".md") || /(^|\/)(AGENTS|CLAUDE|HERMES)\.md$/.test(path);
}

function hasDirectory(paths: ReadonlySet<string>, reference: string): boolean {
  const prefix = reference.endsWith("/") ? reference : `${reference}/`;
  return [...paths].some((path) => path.startsWith(prefix));
}

function findingKey(finding: CustomerTargetIntegrityFinding): string {
  return `${finding.code}\0${finding.path}\0${finding.reference}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
