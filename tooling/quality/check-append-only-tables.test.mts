import { describe, expect, it } from "vitest";
import { validateRawDbMutations } from "./check-append-only-tables.mts";

const path = "packages/convex/confect/example.ts";
const source = (body: string, sourcePath = path) => [
  { path: sourcePath, source: body },
];
const blocked = (body: string) => validateRawDbMutations(source(body), []);

describe("check:append-only-tables", () => {
  it("rejects direct and optional destructive calls by opaque ID", () => {
    expect(
      blocked(
        "async function f(ctx: any, id: any) { await ctx.db.delete(id); }",
      ),
    ).toHaveLength(1);
    expect(
      blocked(
        'async function f(ctx: any, id: any) { await ctx["db"]?.["delete"]?.(id); }',
      ),
    ).toHaveLength(1);
  });

  it("rejects method declaration destructuring and destructuring assignment", () => {
    expect(
      blocked(`async function f(ctx: any, id: any) {
        const { patch: mutate } = ctx.db;
        let remove: any;
        ({ delete: remove } = ctx.db);
        await mutate(id, {});
        await remove(id);
      }`),
    ).toHaveLength(2);
  });

  it("rejects assigned aliases and extracted methods", () => {
    expect(
      blocked(`async function f(ctx: any, id: any) {
        const database = ctx.db;
        const mutate = database.patch;
        await mutate(id, {});
      }`),
    ).toHaveLength(1);
  });

  it("rejects nested helpers and helpers returning raw databases", () => {
    expect(
      blocked(`function raw(ctx: any) { return ctx.db; }
        async function remove(store: any, id: any) { await store.delete(id); }
        async function outer(ctx: any, id: any) {
          await remove(raw(ctx), id);
          await raw(ctx).replace(id, {});
        }`),
    ).toHaveLength(2);
  });

  it("fails closed for dynamic computed access on database provenance", () => {
    expect(
      blocked(`async function f(ctx: any, id: any, method: string) {
        await ctx.db[method](id);
      }`),
    ).toHaveLength(1);
  });

  it("allows unrelated mutable objects even when named db", () => {
    expect(
      blocked(`const db = new Map<string, string>();
        db.delete("x");
        const value = "x".replace(/x/g, "");`),
    ).toEqual([]);
  });

  it("allows inserts and literal table-bound writer mutations", () => {
    expect(
      blocked(`async function f(ctx: any, writer: any, id: any) {
        await ctx.db.insert("events", {});
        await writer.table("mutableSettings").patch(id, {});
      }`),
    ).toEqual([]);
  });

  it("does not infer safety from mutable queries or unrelated ID evidence", () => {
    expect(
      blocked(`const args = { workspaceId: v.id("workspaces") };
        async function f(ctx: any, id: Id<"workflowRuns">) {
          await ctx.db.query("mutableSettings").first();
          await ctx.db.patch(args.workspaceId, {});
        }`),
    ).toHaveLength(1);
  });

  it("does not grant the app deadline file an ID-evidence allowance", () => {
    expect(
      validateRawDbMutations(
        source(
          `const workflowRun = v.id("workflowRuns");
           async function f(ctx: any, id: Id<"workspaces">) {
             await ctx.db.patch(id, {});
           }`,
          "packages/convex/convex/workflows/deadlinesCurrent.ts",
        ),
      ),
    ).toHaveLength(1);
  });

  it("keeps component allowances patch-only and exact-path bound", () => {
    const componentPath =
      "packages/convex/convex/components/workflowDeadline/deadlines.ts";
    const allowance = [
      {
        path: componentPath,
        method: "patch" as const,
        component: "workflowDeadline",
      },
    ];
    const imported = 'import { mutation } from "./_generated/server";';
    const patch =
      "async function f(ctx: any, id: any) { await ctx.db.patch(id, {}); }";
    expect(
      validateRawDbMutations(
        source(`${imported}\n${patch}`, componentPath),
        allowance,
      ),
    ).toEqual([]);
    expect(
      validateRawDbMutations(
        source(`${imported}\n${patch}`, `${componentPath}x`),
        allowance,
      ),
    ).toHaveLength(1);
    expect(
      validateRawDbMutations(
        source(
          `${imported}\nasync function f(ctx: any, id: any) { await ctx.db.delete(id); }`,
          componentPath,
        ),
        allowance,
      ),
    ).toHaveLength(1);
    expect(
      validateRawDbMutations(
        source(`// ${imported}\n${patch}`, componentPath),
        allowance,
      ),
    ).toHaveLength(1);
  });

  it("fails closed on malformed TypeScript", () => {
    expect(
      validateRawDbMutations(source("function broken( {"), [])[0]?.issue,
    ).toBe("TypeScript source does not parse");
  });
});
