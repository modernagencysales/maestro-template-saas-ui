import type { SelectedScreenAuthority } from "./screen-selection";

export type CrudFeatureOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: "reuse" | "extend";
  readonly description?: string;
  readonly frontend: SelectedScreenAuthority;
};

export type CrudGeneratedFile = {
  readonly path: string;
  readonly content: string;
};

function transplantSelectedRoute(frontend: SelectedScreenAuthority): string {
  if (/from\s+["']\.{1,2}\//u.test(frontend.routeSource)) {
    throw new Error(
      `Selected route uses location-dependent relative imports: ${frontend.screenCatalogId}`,
    );
  }
  const component = frontend.routeSource.match(
    /return\s+<([A-Z][A-Za-z0-9_]*)\s+params=\{params\}/u,
  )?.[1];
  if (!component) {
    throw new Error(
      `Selected route has no supported screen params binding: ${frontend.screenCatalogId}`,
    );
  }
  const routeBound = frontend.routeSource
    .replace(
      /import\s+\{\s*createFileRoute\s*\}\s+from\s+(["'])@tanstack\/react-router\1/u,
      'import { createFileRoute, useParams } from "@tanstack/react-router"',
    )
    .replace(
      "Route.useParams()",
      `useParams({ strict: false }) as Parameters<typeof ${component}>[0]["params"]`,
    );
  const transplanted = routeBound.replace(
    /createFileRoute\(\s*["'][^"']+["']\s*\)/u,
    "createFileRoute()",
  );
  if (transplanted === routeBound || routeBound === frontend.routeSource) {
    throw new Error(
      `Selected route has no supported TanStack route binding: ${frontend.screenCatalogId}`,
    );
  }
  return transplanted;
}

const camelCase = (value: string): string => {
  const words = value
    .trim()
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean);
  return words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
};

const pascalCase = (value: string): string => {
  const camel = camelCase(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const kebabCase = (value: string): string =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();

export const buildCrudFeatureFiles = (options: CrudFeatureOptions) => {
  const name = camelCase(options.name);
  const pascalName = pascalCase(options.name);
  const route = kebabCase(options.name);
  const description =
    options.description ??
    `Manage workspace ${route} from one complete CRUD slice.`;
  const featurePath = `apps/web/src/features/${name}`;
  const scaffoldFiles: CrudGeneratedFile[] = [
    {
      path: `${featurePath}/contract.ts`,
      content: `export type ${pascalName}Status = "planned" | "active" | "complete";

export type ${pascalName} = {
  readonly _id: string;
  readonly _creationTime: number;
  readonly workspaceId: string;
  readonly title: string;
  readonly detail: string;
  readonly status: ${pascalName}Status;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type ${pascalName}Write = {
  readonly workspaceId: string;
  readonly title: string;
  readonly detail: string;
  readonly status: ${pascalName}Status;
};

export const ${name}FeatureContract = {
  ownership: { system: "${options.system}", disposition: "${options.disposition}" },
  tenantScope: "workspace",
  auth: "workspace-member",
  operations: ["create", "list", "read", "update", "delete"],
  typedErrors: ["Unauthorized", "ValidationFailed", "Forbidden", "NotFound"],
  audit: { readEvent: "${name}.viewed", writeEvent: "${name}.changed", actorAndWorkspaceRequired: true },
  observability: { operation: "${options.system}.${name}", redactInput: true, captureLatency: true },
  featureFlag: { key: "${options.system}.${route}", default: "off-until-reviewed", killSwitch: true },
  entitlement: { posture: "explicit-plan-or-none", default: "not-entitled" },
  dataLifecycle: { durableResources: ["${name}"] as const },
} as const;
`,
    },
    {
      path: `${featurePath}/adapter.ts`,
      content: `import { GroupSpec, Refs, Spec } from "@maestro-template/convex/refs";
import capability from "../../../../../packages/convex/confect/capabilities/${name}.spec";
import type { ${pascalName} } from "./contract";
import type { ${pascalName}FeatureState } from "./model";

export const ${name}Refs = Refs.make(
  Spec.make().addAt(
    "capabilities",
    GroupSpec.makeAt("capabilities").addGroupAt("${name}", capability),
  ),
).public.capabilities.${name};

type QueryState = {
  readonly data?: readonly ${pascalName}[];
  readonly error?: unknown;
  readonly isError: boolean;
  readonly isPending: boolean;
};

const typedErrors = new Set(["Unauthorized", "ValidationFailed", "Forbidden", "NotFound"]);

export const present${pascalName}Failure = (error: unknown): ${pascalName}FeatureState => {
  const tag = typeof error === "object" && error !== null && "_tag" in error ? error._tag : null;
  return typeof tag === "string" && typedErrors.has(tag)
    ? { status: "typed-error", error: tag as "Unauthorized" | "ValidationFailed" | "Forbidden" | "NotFound" }
    : { status: "transport-error", message: error instanceof Error ? error.message : "${pascalName} unavailable." };
};

export const present${pascalName}State = (state: QueryState): ${pascalName}FeatureState => {
  if (state.isPending) return { status: "loading" };
  if (state.isError) return present${pascalName}Failure(state.error);
  const items = state.data ?? [];
  return items.length === 0 ? { status: "empty" } : { status: "list", items };
};
`,
    },
    {
      path: `${featurePath}/model.ts`,
      content: `import type { ${pascalName} } from "./contract";

export type ${pascalName}FeatureState =
  | { readonly status: "loading" }
  | { readonly status: "empty" }
  | { readonly status: "list"; readonly items: readonly ${pascalName}[] }
  | { readonly status: "detail"; readonly item: ${pascalName} }
  | { readonly status: "create" }
  | { readonly status: "edit"; readonly item: ${pascalName} }
  | { readonly status: "success"; readonly message: string; readonly item?: ${pascalName} }
  | { readonly status: "typed-error"; readonly error: "Unauthorized" | "ValidationFailed" | "Forbidden" | "NotFound" }
  | { readonly status: "transport-error"; readonly message: string };
`,
    },
    {
      path: `${featurePath}/adapter.test.ts`,
      content: `import { describe, expect, it } from "vitest";
import { present${pascalName}Failure, present${pascalName}State } from "./adapter";

describe("${name} presenter", () => {
  const item = { _id: "${name}_1", _creationTime: 1, workspaceId: "a", title: "First", detail: "Detail", status: "planned", createdAt: 1, updatedAt: 1 } as const;
  it("presents query lifecycle states", () => {
    expect(present${pascalName}State({ isPending: true, isError: false })).toEqual({ status: "loading" });
    expect(present${pascalName}State({ data: [], isPending: false, isError: false })).toEqual({ status: "empty" });
    expect(present${pascalName}State({ data: [item], isPending: false, isError: false })).toEqual({ status: "list", items: [item] });
  });
  it("separates typed and transport failures", () => {
    expect(present${pascalName}Failure({ _tag: "Forbidden" })).toEqual({ status: "typed-error", error: "Forbidden" });
    expect(present${pascalName}Failure(new TypeError("offline"))).toEqual({ status: "transport-error", message: "offline" });
  });
});
`,
    },
    {
      path: `packages/convex/confect/capabilities/${name}.spec.ts`,
      content: `import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import table from "../_generated/tables/${name}";
import { Id } from "../_generated/id";
import { Forbidden, NotFound, Unauthorized, ValidationFailed } from "../errors";
const Workspace = Schema.Struct({ workspaceId: Id("workspaces") });
const Identity = Schema.Struct({ workspaceId: Id("workspaces"), id: Id("${name}") });
const Write = Schema.Struct({ workspaceId: Id("workspaces"), title: Schema.String, detail: Schema.String, status: Schema.Literals(["planned", "active", "complete"]) });
const Update = Schema.Struct({ workspaceId: Id("workspaces"), id: Id("${name}"), title: Schema.String, detail: Schema.String, status: Schema.Literals(["planned", "active", "complete"]) });
const ErrorSchema = Schema.Union([Unauthorized, ValidationFailed, Forbidden, NotFound]);
const list = FunctionSpec.publicQuery({ name: "list", args: () => Workspace, returns: () => Schema.Array(table.Doc), error: () => ErrorSchema });
const read = FunctionSpec.publicQuery({ name: "read", args: () => Identity, returns: () => table.Doc, error: () => ErrorSchema });
const create = FunctionSpec.publicMutation({ name: "create", args: () => Write, returns: () => table.Doc, error: () => ErrorSchema });
const update = FunctionSpec.publicMutation({ name: "update", args: () => Update, returns: () => table.Doc, error: () => ErrorSchema });
const remove = FunctionSpec.publicMutation({ name: "remove", args: () => Identity, returns: () => Schema.Boolean, error: () => ErrorSchema });
export default GroupSpec.make().addFunction(list).addFunction(read).addFunction(create).addFunction(update).addFunction(remove);
`,
    },
    {
      path: `packages/convex/confect/capabilities/${name}.impl.ts`,
      content: `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { requireWorkspaceAccess } from "./_kit/workspaceAccess";
import { NotFound, ValidationFailed } from "../errors";
import group from "./${name}.spec";
const withClock = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;
const access = (workspaceId: Parameters<typeof requireWorkspaceAccess>[0], role: "viewer" | "editor") => withClock(requireWorkspaceAccess(workspaceId, role));
const find = (workspaceId: Parameters<typeof requireWorkspaceAccess>[0], id: never) => Effect.gen(function* () {
  const reader = yield* DatabaseReader;
  const item = yield* reader.table("${name}").get(id).pipe(Effect.orDie);
  if (item === null || item.workspaceId !== workspaceId) return yield* new NotFound({ resource: "${name}", id: String(id) });
  return item;
});
const list = FunctionImpl.make(databaseSchema, group, "list", ({ workspaceId }) => Effect.gen(function* () {
  yield* access(workspaceId, "viewer"); const reader = yield* DatabaseReader;
  return yield* reader.table("${name}").index("by_workspace", (query) => query.eq("workspaceId", workspaceId)).take(100).pipe(Effect.orDie);
}));
const read = FunctionImpl.make(databaseSchema, group, "read", ({ workspaceId, id }) => Effect.gen(function* () { yield* access(workspaceId, "viewer"); return yield* find(workspaceId, id as never); }));
const create = FunctionImpl.make(databaseSchema, group, "create", ({ workspaceId, title, detail, status }) => Effect.gen(function* () {
  yield* access(workspaceId, "editor"); const normalized = title.trim();
  if (normalized.length === 0) return yield* new ValidationFailed({ field: "title", message: "${pascalName} title is required." });
  const now = yield* withClock(Clock.currentTimeMillis); const writer = yield* DatabaseWriter;
  const id = yield* writer.table("${name}").insert({ workspaceId, title: normalized, detail: detail.trim(), status, createdAt: now, updatedAt: now }).pipe(Effect.orDie);
  return yield* find(workspaceId, id as never);
}));
const update = FunctionImpl.make(databaseSchema, group, "update", ({ workspaceId, id, title, detail, status }) => Effect.gen(function* () {
  yield* access(workspaceId, "editor"); yield* find(workspaceId, id as never); const normalized = title.trim();
  if (normalized.length === 0) return yield* new ValidationFailed({ field: "title", message: "${pascalName} title is required." });
  const updatedAt = yield* withClock(Clock.currentTimeMillis); const writer = yield* DatabaseWriter;
  yield* writer.table("${name}").patch(id, { title: normalized, detail: detail.trim(), status, updatedAt }).pipe(Effect.orDie);
  return yield* find(workspaceId, id as never);
}));
const remove = FunctionImpl.make(databaseSchema, group, "remove", ({ workspaceId, id }) => Effect.gen(function* () {
  yield* access(workspaceId, "editor"); yield* find(workspaceId, id as never); const writer = yield* DatabaseWriter;
  yield* writer.table("${name}").delete(id).pipe(Effect.orDie); return true;
}));
export default GroupImpl.make(databaseSchema, group).pipe(Layer.provide(list), Layer.provide(read), Layer.provide(create), Layer.provide(update), Layer.provide(remove), GroupImpl.finalize);
`,
    },
    {
      path: `docs/template/generated/features/${name}.md`,
      content: `# ${pascalName} Feature\n\n${description}\n\nFull workspace-isolated create, list, read, update, and delete behavior uses generated Confect refs and the installed Saas UI primitives. Run Confect codegen after the business-entity table recipe step.\n`,
    },
  ];
  const files = [
    ...scaffoldFiles,
    {
      path: `apps/web/src/routes/_app/$workspace/_dashboard/${route}.tsx`,
      content: transplantSelectedRoute(options.frontend),
    },
  ];
  files.push({
    path: `docs/template/generated/provenance/add-feature/${name}.json`,
    content: `${JSON.stringify({ generator: "add-feature", commandFamily: "template:add-feature", name, ownership: { system: options.system, disposition: options.disposition }, frontend: { screenCatalogId: options.frontend.screenCatalogId, sourceReceipt: options.frontend.sourceReceipt, shellId: options.frontend.shellId, allowedAdaptations: options.frontend.allowedAdaptations, requiredVisualStates: options.frontend.requiredVisualStates, repository: options.frontend.repository, source: options.frontend.source, composition: options.frontend.composition, sourceSha256: options.frontend.sourceSha256, destinationSha256: options.frontend.destinationSha256, closureSha256: options.frontend.closureSha256, destinationClosureSha256: options.frontend.destinationClosureSha256, files: options.frontend.files }, generatedPaths: files.map(({ path }) => path) }, null, 2)}\n`,
  });
  return {
    name,
    pascalName,
    route,
    system: options.system,
    disposition: options.disposition,
    files,
    followUp: [
      "Run the crud-business-entity recipe so the durable table matches this contract.",
      "Run pnpm confect:codegen, pnpm --dir apps/web typecheck, and focused adapter tests.",
    ],
  } as const;
};
