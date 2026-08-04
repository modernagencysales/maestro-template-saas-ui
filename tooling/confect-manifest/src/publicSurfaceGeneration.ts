import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import {
  PUBLIC_SURFACE_LEGACY_BASELINE_DIGEST,
  publicSurfaceAuthorityKey,
  type ContractsLegacyBaseline,
  type PublicSurface,
} from "@maestro-template/template-core/publicSurface";
import ts from "typescript";

export type DiscoveredPublicAuthority = PublicSurface["authority"] & {
  readonly transport: PublicSurface["transport"];
};

const relativePath = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/");

const filesBelow = (root: string, directory: string): readonly string[] => {
  const start = join(root, directory);
  if (!existsSync(start)) return [];
  const visit = (path: string): readonly string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const child = join(path, entry.name);
      if (entry.isSymbolicLink() || lstatSync(child).isSymbolicLink())
        return [];
      if (entry.isDirectory()) return visit(child);
      return entry.isFile() ? [child] : [];
    });
  return [...visit(start)].sort((left, right) => left.localeCompare(right));
};

const parseTypeScript = (path: string): ts.SourceFile =>
  ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const property = (
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined => {
  for (const candidate of object.properties) {
    if (!ts.isPropertyAssignment(candidate)) continue;
    const candidateName = candidate.name;
    if (
      (ts.isIdentifier(candidateName) ||
        ts.isStringLiteralLike(candidateName)) &&
      candidateName.text === name
    )
      return candidate.initializer;
  }
  return undefined;
};

const stringValue = (
  expression: ts.Expression | undefined,
): string | undefined =>
  expression !== undefined &&
  (ts.isStringLiteralLike(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : undefined;

const arrayStrings = (
  expression: ts.Expression | undefined,
): readonly string[] =>
  expression !== undefined && ts.isArrayLiteralExpression(expression)
    ? expression.elements.flatMap((element) => {
        const value = stringValue(element as ts.Expression);
        return value === undefined ? [] : [value];
      })
    : [];

const namedArrayObjects = (
  sourceFile: ts.SourceFile,
  variableName: string,
): readonly ts.ObjectLiteralExpression[] => {
  const result: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer !== undefined
    ) {
      let initializer: ts.Expression = node.initializer;
      while (
        ts.isAsExpression(initializer) ||
        ts.isSatisfiesExpression(initializer)
      )
        initializer = initializer.expression;
      if (ts.isArrayLiteralExpression(initializer)) {
        for (const element of initializer.elements) {
          if (ts.isObjectLiteralExpression(element)) result.push(element);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
};

const manifestAuthorities = (
  sourceFile: ts.SourceFile,
): readonly DiscoveredPublicAuthority[] => {
  const result: DiscoveredPublicAuthority[] = [];
  const transport = (
    surface: string,
  ): PublicSurface["transport"] | undefined =>
    surface === "web"
      ? "ui"
      : ["api", "cli", "mcp"].includes(surface)
        ? (surface as "api" | "cli" | "mcp")
        : undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const operationId = stringValue(property(node, "operationId"));
      if (operationId !== undefined) {
        for (const surface of arrayStrings(property(node, "surfaces"))) {
          const publicTransport = transport(surface);
          if (publicTransport !== undefined)
            result.push({
              kind: "convex-function",
              registrationLocator: operationId,
              transport: publicTransport,
            });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
};

const routeAuthorities = (
  root: string,
): readonly DiscoveredPublicAuthority[] => {
  const path = join(root, "apps/web/src/routeTree.gen.ts");
  if (!existsSync(path)) return [];
  const source = readFileSync(path, "utf8");
  const block =
    /interface\s+FileRoutesByFullPath\s*\{(?<body>[\s\S]*?)\n\s*\}/u.exec(
      source,
    )?.groups?.body;
  if (block === undefined) return [];
  return [...block.matchAll(/^\s*['"](?<path>\/[^'"]*)['"]\s*:/gmu)].map(
    (match) => ({
      kind: "route",
      registrationLocator: `apps/web/src/routeTree.gen.ts#${match.groups?.path ?? ""}`,
      transport: "ui",
    }),
  );
};

const callName = (expression: ts.Expression): string | undefined => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isCallExpression(expression)) return callName(expression.expression);
  return undefined;
};

const uiActionAuthorities = (
  root: string,
  path: string,
): readonly DiscoveredPublicAuthority[] => {
  const sourceFile = parseTypeScript(path);
  const result: DiscoveredPublicAuthority[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = callName(node.expression);
      const argument = node.arguments[0];
      if (
        name !== undefined &&
        [
          "useTemplateMutation",
          "useTemplateAction",
          "useMutation",
          "useAction",
          "useConfectMutation",
          "useConfectAction",
        ].includes(name) &&
        !path.endsWith("apps/web/src/adapters/confect-state.ts") &&
        argument !== undefined
      ) {
        result.push({
          kind: "ui-action",
          registrationLocator: relativePath(root, path),
          actionDiscriminant: argument.getText(sourceFile).replace(/\s+/gu, ""),
          transport: "ui",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
};

const equalityLiterals = (
  node: ts.Node,
  identifier: string,
): readonly string[] => {
  const result: string[] = [];
  const visit = (candidate: ts.Node): void => {
    if (
      ts.isBinaryExpression(candidate) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
      ].includes(candidate.operatorToken.kind)
    ) {
      const sides = [candidate.left, candidate.right] as const;
      for (const [left, right] of [sides, [sides[1], sides[0]] as const]) {
        if (
          ts.isIdentifier(left) &&
          left.text === identifier &&
          ts.isStringLiteralLike(right)
        )
          result.push(right.text);
      }
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return [...new Set(result)];
};

const cliAuthorities = (root: string): readonly DiscoveredPublicAuthority[] => {
  const result: DiscoveredPublicAuthority[] = [];
  const commandsPath = join(root, "apps/cli/src/commands.ts");
  if (existsSync(commandsPath)) {
    const sourceFile = parseTypeScript(commandsPath);
    const visit = (node: ts.Node): void => {
      const variableFunction =
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text.startsWith("matches") &&
        node.initializer !== undefined
          ? node.initializer
          : undefined;
      if (variableFunction !== undefined) {
        const commands = equalityLiterals(variableFunction, "command");
        const subcommands = equalityLiterals(variableFunction, "subcommand");
        for (const command of commands) {
          for (const subcommand of subcommands.length === 0
            ? [undefined]
            : subcommands) {
            result.push({
              kind: "command",
              registrationLocator: command,
              ...(subcommand === undefined
                ? {}
                : { actionDiscriminant: subcommand }),
              transport: "cli",
            });
          }
        }
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const path of filesBelow(root, "apps/cli/src/factory").filter(
    (candidate) => /\.ts$/u.test(candidate) && !candidate.endsWith(".test.ts"),
  )) {
    const sourceFile = parseTypeScript(path);
    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const command = stringValue(property(node, "command"));
        if (command !== undefined)
          result.push({
            kind: "command",
            registrationLocator: command,
            transport: "cli",
          });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return result;
};

const mcpAuthorities = (root: string): readonly DiscoveredPublicAuthority[] => {
  const result: DiscoveredPublicAuthority[] = [];
  for (const relativeSource of [
    "tooling/agent-pack/src/mcp/projection.ts",
    "tooling/app-map/src/mcp.ts",
  ]) {
    const path = join(root, relativeSource);
    if (!existsSync(path)) continue;
    for (const entry of namedArrayObjects(parseTypeScript(path), "TOOLS")) {
      const name = stringValue(property(entry, "name"));
      if (name !== undefined)
        result.push({
          kind: "command",
          registrationLocator: name,
          transport: "mcp",
        });
    }
  }
  const workflowSource = join(root, "tooling/workflow/src/index.ts");
  if (
    existsSync(workflowSource) &&
    readFileSync(workflowSource, "utf8").includes("template.workflow.run")
  )
    result.push({
      kind: "command",
      registrationLocator: "template.workflow.run",
      transport: "mcp",
    });
  return result;
};

const httpAuthorities = (
  root: string,
  path: string,
): readonly DiscoveredPublicAuthority[] => {
  const sourceFile = parseTypeScript(path);
  const result: DiscoveredPublicAuthority[] = namedArrayObjects(
    sourceFile,
    "templateHttpRoutes",
  ).flatMap((route) => {
    const pathValue = stringValue(property(route, "path"));
    const method = stringValue(property(route, "method"));
    const kind = stringValue(property(route, "kind"));
    if (
      pathValue === undefined ||
      method === undefined ||
      (kind !== "http-route" && kind !== "webhook")
    )
      return [];
    return [
      {
        kind,
        registrationLocator: `${method.toUpperCase()} ${pathValue}`,
        transport: kind === "webhook" ? "webhook" : "api",
      },
    ];
  });
  const visit = (node: ts.Node): void => {
    const routeArgument = ts.isCallExpression(node)
      ? node.arguments[0]
      : undefined;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "route" &&
      routeArgument !== undefined &&
      ts.isObjectLiteralExpression(routeArgument)
    ) {
      const route = routeArgument;
      const pathValue = stringValue(property(route, "path"));
      const method = stringValue(property(route, "method"));
      if (pathValue !== undefined && method !== undefined) {
        const webhook = pathValue.startsWith("/webhooks/");
        result.push({
          kind: webhook ? "webhook" : "http-route",
          registrationLocator: `${method.toUpperCase()} ${pathValue}`,
          transport: webhook ? "webhook" : "api",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  void root;
  return result;
};

const rawConvexAuthorities = (
  root: string,
  path: string,
): readonly DiscoveredPublicAuthority[] => {
  const sourceFile = parseTypeScript(path);
  const module = relativePath(root, path)
    .replace(/^packages\/convex\/convex\//u, "")
    .replace(/\.tsx?$/u, "");
  const result: DiscoveredPublicAuthority[] = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.initializer === undefined ||
        !ts.isCallExpression(declaration.initializer) ||
        !ts.isIdentifier(declaration.initializer.expression) ||
        !["query", "mutation", "action"].includes(
          declaration.initializer.expression.text,
        )
      )
        continue;
      result.push({
        kind: "convex-function",
        registrationLocator: `${module}:${declaration.name.text}`,
        transport: "api",
      });
    }
  }
  return result;
};

const specPublicAuthorities = (
  root: string,
  path: string,
): readonly DiscoveredPublicAuthority[] => {
  const sourceFile = parseTypeScript(path);
  const module = relativePath(root, path)
    .replace(/^packages\/convex\/confect\//u, "")
    .replace(/\.spec\.ts$/u, "");
  const result: DiscoveredPublicAuthority[] = [];
  const insideContractFunction = (node: ts.Node): boolean => {
    let parent = node.parent;
    while (parent !== undefined) {
      if (
        ts.isCallExpression(parent) &&
        callName(parent.expression) === "defineContractFunction"
      )
        return true;
      parent = parent.parent;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && !insideContractFunction(node)) {
      const name = callName(node.expression);
      if (
        name !== undefined &&
        /^(?:convex)?[Pp]ublic(?:Query|Mutation|Action)$/u.test(name)
      ) {
        const argument = node.arguments[0];
        const directName = stringValue(argument);
        const objectName =
          argument !== undefined && ts.isObjectLiteralExpression(argument)
            ? stringValue(property(argument, "name"))
            : undefined;
        const functionName = directName ?? objectName;
        if (functionName !== undefined)
          result.push({
            kind: "convex-function",
            registrationLocator: `${module}:${functionName}`,
            transport: "api",
          });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
};

const authorityKey = (authority: DiscoveredPublicAuthority): string =>
  JSON.stringify([
    authority.kind,
    authority.registrationLocator,
    authority.actionDiscriminant ?? null,
    authority.transport,
  ]);

export const discoverPublicAuthorities = (
  root: string,
): readonly DiscoveredPublicAuthority[] => {
  const authorities: DiscoveredPublicAuthority[] = [
    ...routeAuthorities(root),
    ...cliAuthorities(root),
    ...mcpAuthorities(root),
  ];
  const sourceFiles = [
    ...filesBelow(root, "apps"),
    ...filesBelow(root, "packages/convex/confect"),
    ...filesBelow(root, "packages/convex/convex"),
    ...filesBelow(root, "tooling/workflow"),
  ].filter(
    (path) =>
      /\.tsx?$/u.test(path) &&
      !/\.test\.tsx?$/u.test(path) &&
      !path.endsWith("routeTree.gen.ts"),
  );

  for (const path of sourceFiles) {
    const source = readFileSync(path, "utf8");
    if (
      path.includes("/apps/web/") &&
      /\b(?:useTemplate(?:Mutation|Action)|use(?:Confect)?(?:Mutation|Action))\b/u.test(
        source,
      )
    )
      authorities.push(...uiActionAuthorities(root, path));
    if (/\.route\s*\(/u.test(source))
      authorities.push(...httpAuthorities(root, path));
    if (path.endsWith(".spec.ts") && path.includes("/packages/convex/confect/"))
      authorities.push(...specPublicAuthorities(root, path));
    if (path.includes("/packages/convex/convex/"))
      authorities.push(...rawConvexAuthorities(root, path));
  }
  const inventoryManifestPath = join(
    root,
    "packages/convex/confect/_generated/confectManifest.inventory.ts",
  );
  if (existsSync(inventoryManifestPath))
    authorities.push(
      ...manifestAuthorities(parseTypeScript(inventoryManifestPath)),
    );
  const runtimeManifestPath = join(
    root,
    "packages/template-core/src/generated/confectManifest.ts",
  );
  if (existsSync(runtimeManifestPath)) {
    for (const authority of manifestAuthorities(
      parseTypeScript(runtimeManifestPath),
    ))
      if (authority.transport === "api")
        authorities.push({
          kind: "http-route",
          registrationLocator: `POST /api/${authority.registrationLocator}`,
          transport: "api",
        });
  }

  return authorities.sort((left, right) =>
    authorityKey(left).localeCompare(authorityKey(right)),
  );
};

export const generatePublicSurfaceInventory = (input: {
  readonly discovered: readonly DiscoveredPublicAuthority[];
  readonly registered: readonly PublicSurface[];
}): { readonly surfaces: readonly PublicSurface[] } => {
  const discoveredKeys = input.discovered.map(authorityKey);
  const duplicateDiscovery = discoveredKeys.find(
    (key, index) => discoveredKeys.indexOf(key) !== index,
  );
  if (duplicateDiscovery !== undefined)
    throw new Error(
      `duplicate discovered public authority: ${duplicateDiscovery}`,
    );

  const registeredKeys = input.registered.map((surface) =>
    authorityKey({ ...surface.authority, transport: surface.transport }),
  );
  const duplicateRegistration = registeredKeys.find(
    (key, index) => registeredKeys.indexOf(key) !== index,
  );
  if (duplicateRegistration !== undefined)
    throw new Error(
      `duplicate registered public authority: ${duplicateRegistration}`,
    );

  const ids = input.registered.map(({ id }) => id);
  const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicateId !== undefined)
    throw new Error(`duplicate public surface id: ${duplicateId}`);

  const registeredSet = new Set(registeredKeys);
  const missingRegistration = discoveredKeys.find(
    (key) => !registeredSet.has(key),
  );
  if (missingRegistration !== undefined)
    throw new Error(`unregistered public authority: ${missingRegistration}`);

  const discoveredSet = new Set(discoveredKeys);
  const missingDiscovery = registeredKeys.find(
    (key) => !discoveredSet.has(key),
  );
  if (missingDiscovery !== undefined)
    throw new Error(
      `registered surface has no discovered authority: ${missingDiscovery}`,
    );

  return {
    surfaces: [...input.registered].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
};

const sha256 = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const adoptLegacyPublicSurfaces = (
  discovered: readonly DiscoveredPublicAuthority[],
): readonly PublicSurface[] => {
  const keys = discovered.map(authorityKey);
  const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
  if (duplicate !== undefined)
    throw new Error(`duplicate discovered public authority: ${duplicate}`);
  return [...discovered]
    .sort((left, right) =>
      authorityKey(left).localeCompare(authorityKey(right)),
    )
    .map((authority) => {
      const digest = sha256(authorityKey(authority)).slice(
        "sha256:".length,
        24 + 7,
      );
      return {
        id: `legacy_${digest}`,
        transport: authority.transport,
        coverageTag: `@covers_legacy_${digest}` as const,
        authPolicyId: "auth_deny_all" as const,
        authority: {
          kind: authority.kind,
          registrationLocator: authority.registrationLocator,
          ...(authority.actionDiscriminant === undefined
            ? {}
            : { actionDiscriminant: authority.actionDiscriminant }),
        },
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

export const buildContractsLegacyBaseline = (
  surfaces: readonly PublicSurface[],
): ContractsLegacyBaseline => {
  const sorted = [...surfaces].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  return {
    schemaVersion: 1,
    capturedFromInventoryDigest: sha256(JSON.stringify({ surfaces: sorted })),
    surfaces: sorted.map((surface) => ({
      id: surface.id,
      authorityKey: publicSurfaceAuthorityKey(surface),
    })),
  };
};

export const verifyContractsLegacyBaseline = (
  surfaces: readonly PublicSurface[],
  baseline: ContractsLegacyBaseline,
): readonly string[] => {
  const findings: string[] = [];
  if (
    buildContractsLegacyBaseline(surfaces).capturedFromInventoryDigest !==
    baseline.capturedFromInventoryDigest
  )
    findings.push("legacy baseline inventory digest changed");
  const current = new Map(
    surfaces.map((surface) => [surface.id, publicSurfaceAuthorityKey(surface)]),
  );
  const frozen = new Map(
    baseline.surfaces.map((surface) => [surface.id, surface.authorityKey]),
  );
  for (const [id, key] of current) {
    const expected = frozen.get(id);
    if (expected === undefined) findings.push(`legacy baseline growth: ${id}`);
    else if (expected !== key)
      findings.push(`legacy baseline authority changed: ${id}`);
  }
  for (const id of frozen.keys())
    if (!current.has(id))
      findings.push(`legacy baseline surface missing: ${id}`);
  return findings.sort((left, right) => left.localeCompare(right));
};

export const verifyLegacyBaselineTrustAnchor = (
  baseline: ContractsLegacyBaseline,
  expectedDigest: `sha256:${string}` = PUBLIC_SURFACE_LEGACY_BASELINE_DIGEST,
): readonly string[] =>
  baseline.capturedFromInventoryDigest === expectedDigest
    ? []
    : [
        `legacy baseline trust anchor mismatch: expected ${expectedDigest}, got ${baseline.capturedFromInventoryDigest}`,
      ];

export const checkGeneratedPublicSurfaceInventory = (
  root: string,
): readonly string[] => {
  const inventoryPath = join(
    root,
    "packages/template-core/src/generated/public-surfaces.generated.json",
  );
  const baselinePath = join(
    root,
    "packages/template-core/src/generated/template-contracts-legacy-baseline.json",
  );
  if (!existsSync(inventoryPath))
    return [`generated public surface inventory missing: ${inventoryPath}`];
  if (!existsSync(baselinePath))
    return [`public surface legacy baseline missing: ${baselinePath}`];

  try {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
      readonly surfaces: readonly PublicSurface[];
    };
    const baseline = JSON.parse(
      readFileSync(baselinePath, "utf8"),
    ) as ContractsLegacyBaseline;
    generatePublicSurfaceInventory({
      discovered: discoverPublicAuthorities(root),
      registered: inventory.surfaces,
    });
    return [
      ...verifyLegacyBaselineTrustAnchor(baseline),
      ...verifyContractsLegacyBaseline(inventory.surfaces, baseline),
    ];
  } catch (error: unknown) {
    return [error instanceof Error ? error.message : String(error)];
  }
};
