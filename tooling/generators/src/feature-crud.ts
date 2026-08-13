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
      content: `import type { TemplateDataState, TemplateMutationState } from "../../adapters/confect-state";
import type { ${pascalName} } from "./contract";
import type { ${pascalName}FeatureState } from "./model";

const typedErrors = ["Unauthorized", "ValidationFailed", "Forbidden", "NotFound"] as const;
type TypedError = (typeof typedErrors)[number];

const typedErrorTag = (error: unknown): TypedError | null => {
  if (typeof error !== "object" || error === null || !("_tag" in error)) return null;
  const tag = error._tag;
  return typeof tag === "string" && typedErrors.some((candidate) => candidate === tag)
    ? (tag as TypedError)
    : null;
};

export const present${pascalName}State = (
  state: TemplateDataState<readonly ${pascalName}[], unknown>,
): ${pascalName}FeatureState => {
  if (state.status === "skipped" || state.status === "loading") return { status: "loading" };
  if (state.status === "empty") return { status: "empty" };
  if (state.status === "ready") {
    return state.data.length === 0 ? { status: "empty" } : { status: "list", items: state.data };
  }
  if (state.status === "typed_failure") {
    const error = typedErrorTag(state.error);
    return error === null
      ? { status: "transport-error", message: "Unexpected typed failure." }
      : { status: "typed-error", error };
  }
  return { status: "transport-error", message: state.message };
};

export const present${pascalName}Mutation = (
  state: TemplateMutationState<unknown, unknown>,
  successMessage: string,
): ${pascalName}FeatureState | null => {
  if (state.status === "loading") return null;
  if (state.status === "ready") return { status: "success", message: successMessage };
  if (state.status === "typed_failure") {
    const error = typedErrorTag(state.error);
    return error === null
      ? { status: "transport-error", message: "Unexpected typed failure." }
      : { status: "typed-error", error };
  }
  return { status: "transport-error", message: state.message };
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
  | { readonly status: "detail"; readonly item: ${pascalName}; readonly items: readonly ${pascalName}[] }
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
import { templateConfectRefs, type TemplateConfectRefs } from "@maestro-template/convex/refs";
import { classifyConfectMutationResult, normalizeMutationError, useTemplateMutation, useTemplateQuery } from "../../adapters/confect-state";
import { useWorkspace } from "../../providers/workspace";
import { present${pascalName}Mutation, present${pascalName}State } from "./adapter";
import type { ${pascalName} } from "./contract";
import type { ${pascalName}FeatureState } from "./model";
import { ${pascalName}View, type ${pascalName}Draft } from "./${route}-view";

type CapabilityRefs = TemplateConfectRefs["public"]["capabilities"]["${name}"];
type WorkspaceId = Ref.Args<CapabilityRefs["list"]>["workspaceId"];
type ItemId = Ref.Args<CapabilityRefs["read"]>["id"];

const emptyDraft: ${pascalName}Draft = { title: "", detail: "", status: "planned" };

export function ${pascalName}Feature() {
  const workspace = useWorkspace();
  const workspaceId = workspace.status === "ready" ? (workspace.activeWorkspaceId as WorkspaceId) : null;
  const query = useTemplateQuery(
    templateConfectRefs.public.capabilities.${name}.list,
    workspaceId === null ? "skip" : { workspaceId },
    { isEmpty: (items) => items.length === 0 },
  );
  const createItem = useTemplateMutation(templateConfectRefs.public.capabilities.${name}.create);
  const updateItem = useTemplateMutation(templateConfectRefs.public.capabilities.${name}.update);
  const deleteItem = useTemplateMutation(templateConfectRefs.public.capabilities.${name}.remove);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<${pascalName}Draft>(emptyDraft);
  const [feedback, setFeedback] = useState<${pascalName}FeatureState | null>(null);
  const baseState = present${pascalName}State(query);
  const items = baseState.status === "list" ? baseState.items : [];
  const selected = items.find((item) => item._id === selectedId) ?? null;
  const state: ${pascalName}FeatureState = feedback ?? (
    mode === "create" ? { status: "create" }
      : mode === "edit" && selected !== null ? { status: "edit", item: selected }
      : selected !== null ? { status: "detail", item: selected, items }
      : baseState
  );

  const save = async () => {
    if (workspaceId === null) return;
    try {
      const result = mode === "edit" && selected !== null
        ? await updateItem({ workspaceId, id: selected._id as ItemId, ...draft })
        : await createItem({ workspaceId, ...draft });
      setFeedback(present${pascalName}Mutation(classifyConfectMutationResult(result), "${pascalName} saved."));
    } catch (error) {
      setFeedback(present${pascalName}Mutation(normalizeMutationError(error), "${pascalName} saved."));
    }
  };
  const remove = async () => {
    if (selected === null || workspaceId === null) return;
    try {
      const result = await deleteItem({ workspaceId, id: selected._id as ItemId });
      setFeedback(present${pascalName}Mutation(classifyConfectMutationResult(result), "${pascalName} deleted."));
    } catch (error) {
      setFeedback(present${pascalName}Mutation(normalizeMutationError(error), "${pascalName} deleted."));
    }
  };

  return <${pascalName}View
    draft={draft}
    onCancel={() => { setMode("list"); setFeedback(null); }}
    onCreate={() => { setDraft(emptyDraft); setMode("create"); setFeedback(null); }}
    onDelete={() => void remove()}
    onDraftChange={setDraft}
    onEdit={(item: ${pascalName}) => { setDraft({ title: item.title, detail: item.detail, status: item.status }); setMode("edit"); setFeedback(null); }}
    onSave={() => void save()}
    onSelect={setSelectedId}
    state={state}
  />;
}
`,
    },
    {
      path: `${featurePath}/${route}-view.tsx`,
      content: `import { Button, Field, HStack, Input, NativeSelect, Stack, Text, Textarea } from "@saas-ui/react";
import { FormSection, PageStateView, RecordListDetail } from "../../saas-ui/patterns";
import type { ${pascalName}, ${pascalName}Status } from "./contract";
import type { ${pascalName}FeatureState } from "./model";

export type ${pascalName}Draft = { readonly title: string; readonly detail: string; readonly status: ${pascalName}Status };
type ViewProps = {
  readonly draft: ${pascalName}Draft;
  readonly onCancel: () => void;
  readonly onCreate: () => void;
  readonly onDelete: () => void;
  readonly onDraftChange: (draft: ${pascalName}Draft) => void;
  readonly onEdit: (item: ${pascalName}) => void;
  readonly onSave: () => void;
  readonly onSelect: (id: string) => void;
  readonly state: ${pascalName}FeatureState;
};

const recordsFor = (items: readonly ${pascalName}[]) => items.map((item) => ({ id: item._id, label: item.title, description: item.status }));

function ${pascalName}Form({ draft, onCancel, onDraftChange, onSave, title }: Pick<ViewProps, "draft" | "onCancel" | "onDraftChange" | "onSave"> & { readonly title: string }) {
  return <FormSection description="${description}" onSubmit={onSave} title={title}>
    <Field.Root required><Field.Label>Title</Field.Label><Input aria-label="${pascalName} title" onChange={(event) => onDraftChange({ ...draft, title: event.currentTarget.value })} value={draft.title} /></Field.Root>
    <Field.Root><Field.Label>Detail</Field.Label><Textarea aria-label="${pascalName} detail" onChange={(event) => onDraftChange({ ...draft, detail: event.currentTarget.value })} value={draft.detail} /></Field.Root>
    <Field.Root><Field.Label>Status</Field.Label><NativeSelect aria-label="${pascalName} status" onChange={(event) => onDraftChange({ ...draft, status: event.currentTarget.value as ${pascalName}Status })} value={draft.status}><option value="planned">Planned</option><option value="active">Active</option><option value="complete">Complete</option></NativeSelect></Field.Root>
    <Button onClick={onCancel} type="button" variant="ghost">Cancel</Button>
  </FormSection>;
}

export function ${pascalName}View(props: ViewProps) {
  const { state } = props;
  if (state.status === "loading") return <PageStateView description="Waiting for the active workspace and its records." state="loading" title="${pascalName}" />;
  if (state.status === "empty") return <PageStateView action={{ label: "Create ${name}", onClick: props.onCreate }} description="No ${route} have been created in this workspace." state="empty" title="No ${route} yet" />;
  if (state.status === "typed-error") return <PageStateView description={state.error} state="failure" title="${pascalName} request rejected" />;
  if (state.status === "transport-error") return <PageStateView description={state.message} state="failure" title="${pascalName} unavailable" />;
  if (state.status === "success") return <PageStateView action={{ label: "Back to ${route}", onClick: props.onCancel }} description={state.message} state="success" title="Change saved" />;
  if (state.status === "create") return <${pascalName}Form {...props} title="Create ${name}" />;
  if (state.status === "edit") return <${pascalName}Form {...props} title={\`Edit \${state.item.title}\`} />;
  const items = state.items;
  const detail = state.status === "detail" ? <PageStateView description={state.item.detail || "No detail provided."} state="read" title={state.item.title}>
    <Stack gap="3"><Text color="fg.muted">Status: {state.item.status}</Text><HStack><Button onClick={() => props.onEdit(state.item)} variant="outline">Edit ${name}</Button><Button onClick={props.onDelete} variant="outline">Delete ${name}</Button></HStack></Stack>
  </PageStateView> : <PageStateView description="Choose a record from the list." state="read" title="Select ${name}" />;
  return <RecordListDetail detail={detail} onSelect={props.onSelect} records={recordsFor(items)} selectedId={state.status === "detail" ? state.item._id : undefined} />;
}
`,
    },
    {
      path: `${featurePath}/adapter.test.ts`,
      content: `import { describe, expect, it } from "vitest";
import { present${pascalName}Mutation, present${pascalName}State } from "./adapter";

const item = { _id: "${name}_1", _creationTime: 1, workspaceId: "workspace_1", title: "First", detail: "Detail", status: "planned", createdAt: 1, updatedAt: 1 } as const;

describe("${name} presenter", () => {
  it("presents query lifecycle states", () => {
    expect(present${pascalName}State({ status: "loading" })).toEqual({ status: "loading" });
    expect(present${pascalName}State({ status: "empty", data: [] })).toEqual({ status: "empty" });
    expect(present${pascalName}State({ status: "ready", mode: "read", data: [item] })).toEqual({ status: "list", items: [item] });
    expect(present${pascalName}State({ status: "typed_failure", error: { _tag: "Forbidden" } })).toEqual({ status: "typed-error", error: "Forbidden" });
  });
  it("presents mutation success and transport failure", () => {
    expect(present${pascalName}Mutation({ status: "ready", mode: "read", mutation: "success", data: item }, "Saved.")).toEqual({ status: "success", message: "Saved." });
    expect(present${pascalName}Mutation({ status: "transport_failure", error: new TypeError("offline"), message: "offline" }, "Saved.")).toEqual({ status: "transport-error", message: "offline" });
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
      path: `apps/web/src/routes/_workspace.${route}.tsx`,
      content: `import { createFileRoute } from "@tanstack/react-router";
import { ${pascalName}Screen } from "../screens/${route}-screen";
export const Route = createFileRoute("/_workspace/${route}")({ component: ${pascalName}Screen });
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
      content: `# ${pascalName} Feature\n\n${description}\n\nFull workspace-isolated create, list, read, update, and delete behavior uses workspace-scoped Confect operations and the checked-in Saas UI composition shelf. Run Confect codegen after the business-entity table recipe step.\n`,
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
