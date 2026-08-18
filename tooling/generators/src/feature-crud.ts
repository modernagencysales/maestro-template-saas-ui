export type CrudFeatureOptions = {
  readonly name: string;
  readonly system: string;
  readonly disposition: "reuse" | "extend";
  readonly description?: string;
};

export type CrudGeneratedFile = {
  readonly path: string;
  readonly content: string;
};

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
  const files: CrudGeneratedFile[] = [
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
      content: `import type { ${pascalName} } from "./contract";
import type { ${pascalName}FeatureState } from "./model";

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
      path: `${featurePath}/${route}-feature.tsx`,
      content: `import { useState } from "react";
import type { Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import { NativeSelect } from "@chakra-ui/react";
import { Button, Card, Heading, Input, Stack, Text } from "@saas-ui/react";
import * as Result from "effect/Result";
import { templateConfectRefs, type TemplateConfectRefs } from "@maestro-template/convex/refs";
import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";
import { present${pascalName}Failure, present${pascalName}State } from "./adapter";
import type { ${pascalName}Status } from "./contract";
import type { ${pascalName}FeatureState } from "./model";

type CapabilityRefs = TemplateConfectRefs["public"]["capabilities"]["${name}"];
type WorkspaceId = Ref.Args<CapabilityRefs["list"]>["workspaceId"];
type ItemId = Ref.Args<CapabilityRefs["read"]>["id"];

export function ${pascalName}Feature() {
  const [workspace] = useCurrentWorkspace();
  const workspaceId = workspace?.id as WorkspaceId | undefined;
  const query = useQuery(
    templateConfectRefs.public.capabilities.${name}.list,
    workspaceId === undefined ? "skip" : { workspaceId },
  );
  const createItem = useMutation(templateConfectRefs.public.capabilities.${name}.create);
  const updateItem = useMutation(templateConfectRefs.public.capabilities.${name}.update);
  const removeItem = useMutation(templateConfectRefs.public.capabilities.${name}.remove);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<${pascalName}Status>("planned");
  const [feedback, setFeedback] = useState<${pascalName}FeatureState | null>(null);
  const baseState = present${pascalName}State({
    data: QueryResult.isSuccess(query) ? query.value : undefined,
    error: QueryResult.isFailure(query) ? query.error : undefined,
    isError: QueryResult.isFailure(query),
    isPending: QueryResult.isLoading(query),
  });
  const items = baseState.status === "list" ? baseState.items : [];
  const selected = items.find((item) => item._id === selectedId) ?? null;
  const state: ${pascalName}FeatureState = feedback ?? (mode === "create"
    ? { status: "create" }
    : mode === "edit" && selected !== null
      ? { status: "edit", item: selected }
      : selected !== null
        ? { status: "detail", item: selected }
        : baseState);

  const save = async () => {
    if (workspaceId === undefined) return;
    try {
      const input = { workspaceId, title, detail, status };
      const result = mode === "edit" && selected !== null
        ? await updateItem({ ...input, id: selected._id as ItemId })
        : await createItem(input);
      if (Result.isFailure(result)) { setFeedback(present${pascalName}Failure(result.failure)); return; }
      setSelectedId(null); setMode("list"); setFeedback({ status: "success", message: "${pascalName} saved." });
    } catch (error) { setFeedback(present${pascalName}Failure(error)); }
  };
  const remove = async () => {
    if (selected === null || workspaceId === undefined) return;
    try { const result = await removeItem({ workspaceId, id: selected._id as ItemId }); if (Result.isFailure(result)) { setFeedback(present${pascalName}Failure(result.failure)); return; } setSelectedId(null); setFeedback({ status: "success", message: "${pascalName} deleted." }); }
    catch (error) { setFeedback(present${pascalName}Failure(error)); }
  };
  const beginEdit = () => { if (selected === null) return; setTitle(selected.title); setDetail(selected.detail); setStatus(selected.status); setMode("edit"); };

  return <Stack as="section" aria-label="${pascalName} workspace" gap="4">
    <Heading size="md">${description}</Heading>
    {state.status === "loading" ? <Text>Loading ${route}…</Text> : null}
    {state.status === "empty" ? <Text>No ${route} yet.</Text> : null}
    {state.status === "typed-error" ? <Text role="alert">{state.error}</Text> : null}
    {state.status === "transport-error" ? <Text role="alert">{state.message}</Text> : null}
    {state.status === "success" ? <Text role="status">{state.message}</Text> : null}
    {state.status === "list" ? state.items.map((item) => <Button key={item._id} onClick={() => setSelectedId(item._id)} variant="outline">{item.title}</Button>) : null}
    {state.status === "detail" ? <Card.Root><Card.Body><Heading size="sm">{state.item.title}</Heading><Text>{state.item.detail}</Text><Button onClick={beginEdit}>Edit ${name}</Button><Button onClick={() => void remove()}>Delete ${name}</Button></Card.Body></Card.Root> : null}
    {state.status === "create" || state.status === "edit" ? <Card.Root><Card.Body gap="3">
      <Input aria-label="${pascalName} title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Input aria-label="${pascalName} detail" value={detail} onChange={(event) => setDetail(event.target.value)} />
      <NativeSelect.Root><NativeSelect.Field aria-label="${pascalName} status" value={status} onChange={(event) => setStatus(event.target.value as ${pascalName}Status)}><option value="planned">Planned</option><option value="active">Active</option><option value="complete">Complete</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      <Button onClick={() => void save()}>Save ${name}</Button>
    </Card.Body></Card.Root> : null}
    {state.status !== "create" && state.status !== "edit" ? <Button onClick={() => { setSelectedId(null); setFeedback(null); setTitle(""); setDetail(""); setStatus("planned"); setMode("create"); }}>Create ${name}</Button> : null}
    {selected !== null ? <Button onClick={() => { setSelectedId(null); setFeedback(null); setMode("list"); }}>Back to ${route}</Button> : null}
  </Stack>;
}
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
      path: `apps/web/src/screens/${route}-screen.tsx`,
      content: `import { Page } from "@saas-ui/react";
import { ${pascalName}Feature } from "../features/${name}/${route}-feature";
export function ${pascalName}Screen() { return <Page.Root><Page.Header title="${pascalName}" description={${JSON.stringify(description)}} /><Page.Body><${pascalName}Feature /></Page.Body></Page.Root>; }
`,
    },
    {
      path: `apps/web/src/routes/_app/$workspace/_dashboard/${route}.tsx`,
      content: `import { createFileRoute } from "@tanstack/react-router";
import { ${pascalName}Screen } from "../../../../screens/${route}-screen";
export const Route = createFileRoute("/_app/$workspace/_dashboard/${route}")({ component: ${pascalName}Screen });
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
  files.push({
    path: `docs/template/generated/provenance/add-feature/${name}.json`,
    content: `${JSON.stringify({ generator: "add-feature", commandFamily: "template:add-feature", name, ownership: { system: options.system, disposition: options.disposition }, generatedPaths: files.map(({ path }) => path) }, null, 2)}\n`,
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
