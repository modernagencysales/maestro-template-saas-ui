import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { Capability } from "../confect/capabilities/catalog.spec";
import refs from "../confect/_generated/refs";
import spec from "../confect/_generated/spec";
import {
  Forbidden,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../confect/errors";

describe("Confect backend contracts", () => {
  it("generates stable refs for public Confect and plain Convex functions", () => {
    expect(Object.keys(refs)).toEqual(["public", "internal"]);
    expect(refs.public.auth.workspaces.list).toMatchObject({
      functionNamespace: "auth/workspaces",
      functionSpec: {
        name: "list",
        functionVisibility: "public",
      },
    });
    expect(refs.public.brain.pages.createMarkdown).toMatchObject({
      functionNamespace: "brain/pages",
      functionSpec: {
        name: "createMarkdown",
        functionVisibility: "public",
      },
    });
    expect(refs.public.capabilities.catalog.list).toMatchObject({
      functionNamespace: "capabilities/catalog",
      functionSpec: {
        name: "list",
        functionVisibility: "public",
      },
    });
    expect(refs.public.jobs.workpool.enqueue).toMatchObject({
      functionNamespace: "jobs/workpool",
      functionSpec: {
        name: "enqueue",
        functionVisibility: "public",
      },
    });
    expect(refs.internal.jobs.workpool.backgroundWork).toMatchObject({
      functionNamespace: "jobs/workpool",
      functionSpec: {
        name: "backgroundWork",
        functionVisibility: "internal",
      },
    });
    expect(JSON.stringify(spec)).toContain("capabilities");
    expect(JSON.stringify(spec)).toContain("workpool");
  });

  it("validates capability catalog rows with Effect schemas", () => {
    const valid = Schema.decodeUnknownSync(Capability)({
      key: "brain.page.createMarkdown",
      name: "Create Brain page",
      description: "Stores a cited markdown note in the workspace Brain.",
      headlessExposure: "api",
      requiresApproval: false,
    });

    expect(valid).toEqual({
      key: "brain.page.createMarkdown",
      name: "Create Brain page",
      description: "Stores a cited markdown note in the workspace Brain.",
      headlessExposure: "api",
      requiresApproval: false,
    });
    expect(() =>
      Schema.decodeUnknownSync(Capability)({
        key: "bad",
        name: "Bad Capability",
        description: "Wrong exposure should fail.",
        headlessExposure: "raw-sdk",
        requiresApproval: false,
      }),
    ).toThrow();
  });

  it("declares public-safe typed errors with exact tags and fields", () => {
    const errorSchema = Schema.Union([
      Unauthorized,
      Forbidden,
      WorkspaceNotFound,
      ValidationFailed,
    ]);
    const errors = [
      new Unauthorized(),
      new Forbidden({ reason: "missing capability grant" }),
      new WorkspaceNotFound({ workspaceId: "workspace_missing" }),
      new ValidationFailed({ field: "slug", message: "Slug is required." }),
    ].map((error) => Schema.encodeSync(errorSchema)(error));

    expect(errors).toEqual([
      { _tag: "Unauthorized" },
      { _tag: "Forbidden", reason: "missing capability grant" },
      { _tag: "WorkspaceNotFound", workspaceId: "workspace_missing" },
      {
        _tag: "ValidationFailed",
        field: "slug",
        message: "Slug is required.",
      },
    ]);
    expect(JSON.stringify(errors)).not.toContain("stack");
    expect(JSON.stringify(errors)).not.toContain("secret");
  });
});
