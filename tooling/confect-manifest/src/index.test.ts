import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";
import {
  buildContractManifest,
  buildContractJsonSchemas,
  duplicateOperationIds,
  manifestPublicSurfaces,
  manifestOperationIds,
  mergeContractSchemaRegistries,
  missingSchemasForManifest,
} from "./index";

describe("confect manifest tooling", () => {
  it("sorts operation ids for deterministic output", () => {
    const manifest = buildContractManifest([
      {
        namespace: "b",
        name: "run",
        operationId: "b.run",
        kind: "mutation",
        surfaces: ["api"],
        typedErrors: ["Unauthorized"],
        idempotent: false,
        argsSchemaName: "b.run.args",
        returnsSchemaName: "b.run.returns",
      },
      {
        namespace: "a",
        name: "list",
        operationId: "a.list",
        kind: "query",
        surfaces: ["web"],
        typedErrors: ["WorkspaceNotFound"],
        idempotent: true,
        argsSchemaName: "a.list.args",
        returnsSchemaName: "a.list.returns",
      },
    ]);

    expect(manifestOperationIds(manifest)).toEqual(["a.list", "b.run"]);
  });

  it("finds duplicate operation ids once in sorted order", () => {
    expect(
      duplicateOperationIds([
        {
          namespace: "b",
          name: "run",
          operationId: "b.run",
          kind: "mutation",
          surfaces: ["api"],
          typedErrors: [],
          idempotent: false,
          argsSchemaName: "b.run.args",
          returnsSchemaName: "b.run.returns",
        },
        {
          namespace: "a",
          name: "list",
          operationId: "a.list",
          kind: "query",
          surfaces: ["web"],
          typedErrors: [],
          idempotent: true,
          argsSchemaName: "a.list.args",
          returnsSchemaName: "a.list.returns",
        },
        {
          namespace: "b",
          name: "runAgain",
          operationId: "b.run",
          kind: "action",
          surfaces: ["workflow"],
          typedErrors: [],
          idempotent: false,
          argsSchemaName: "b.runAgain.args",
          returnsSchemaName: "b.runAgain.returns",
        },
        {
          namespace: "a",
          name: "listAgain",
          operationId: "a.list",
          kind: "query",
          surfaces: ["web"],
          typedErrors: [],
          idempotent: true,
          argsSchemaName: "a.listAgain.args",
          returnsSchemaName: "a.listAgain.returns",
        },
      ]),
    ).toEqual(["a.list", "b.run"]);
  });

  it("merges schema registries with later registries taking precedence", () => {
    expect(
      mergeContractSchemaRegistries(
        { shared: Schema.String, "a.args": Schema.String },
        { shared: Schema.Number, "b.returns": Schema.Boolean },
      ),
    ).toEqual({
      shared: Schema.Number,
      "a.args": Schema.String,
      "b.returns": Schema.Boolean,
    });
  });

  it("reports missing manifest schemas in deterministic order", () => {
    const manifest = buildContractManifest([
      {
        namespace: "b",
        name: "run",
        operationId: "b.run",
        kind: "mutation",
        surfaces: ["api"],
        typedErrors: [],
        idempotent: false,
        argsSchemaName: "b.run.args",
        returnsSchemaName: "b.run.returns",
      },
      {
        namespace: "a",
        name: "list",
        operationId: "a.list",
        kind: "query",
        surfaces: ["web"],
        typedErrors: [],
        idempotent: true,
        argsSchemaName: "a.list.args",
        returnsSchemaName: "a.list.returns",
      },
    ]);

    expect(
      missingSchemasForManifest(manifest, {
        "b.run.args": Schema.String,
      }),
    ).toEqual(["a.list.args", "a.list.returns", "b.run.returns"]);
  });

  it("builds Effect JSON schemas for OpenAPI and MCP targets", () => {
    expect(
      buildContractJsonSchemas({
        "a.run.args": Schema.Struct({
          workspaceId: Schema.String,
          title: Schema.String,
        }),
        "a.run.returns": Schema.Struct({
          ok: Schema.Literal(true),
        }),
      }),
    ).toMatchObject({
      openApi31: {
        "a.run.args": {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          required: ["workspaceId", "title"],
          properties: {
            workspaceId: { type: "string" },
            title: { type: "string" },
          },
        },
      },
      mcp: {
        "a.run.returns": {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          required: ["ok"],
          properties: {
            ok: { type: "boolean", enum: [true] },
          },
        },
      },
    });
  });

  it("preserves named definitions in both public schema targets", () => {
    const RunArgs = Schema.Struct({
      workspaceId: Schema.String,
    }).annotate({ identifier: "RunArgs" });

    const schemas = buildContractJsonSchemas({ RunArgs });
    const expected = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $ref: "#/$defs/RunArgs",
      $defs: {
        RunArgs: {
          type: "object",
          required: ["workspaceId"],
          properties: { workspaceId: { type: "string" } },
          additionalProperties: false,
        },
      },
    };

    expect(schemas.openApi31.RunArgs).toEqual(expected);
    expect(schemas.mcp.RunArgs).toEqual(expected);
  });

  it("normalizes OpenAPI component names without changing MCP definitions", () => {
    const RunArgs = Schema.Struct({
      workspaceId: Schema.String,
    }).annotate({ identifier: "Run Args" });

    const schemas = buildContractJsonSchemas({ RunArgs });

    expect(schemas.openApi31.RunArgs).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $ref: "#/$defs/Run_Args",
      $defs: {
        Run_Args: {
          type: "object",
          required: ["workspaceId"],
          properties: { workspaceId: { type: "string" } },
          additionalProperties: false,
        },
      },
    });
    expect(schemas.mcp.RunArgs).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $ref: "#/$defs/Run Args",
      $defs: {
        "Run Args": {
          type: "object",
          required: ["workspaceId"],
          properties: { workspaceId: { type: "string" } },
          additionalProperties: false,
        },
      },
    });
  });

  it("emits one public surface per registered transport and defaults auth closed", () => {
    const manifest = buildContractManifest([
      {
        namespace: "brain.pages",
        name: "createMarkdown",
        operationId: "brain.pages.createMarkdown",
        kind: "mutation",
        surfaces: ["web", "cli"],
        surfaceRegistrations: [
          {
            id: "brain_pages_create_ui",
            surface: "web",
            coverageTag: "@covers_brain_pages_create_ui",
            authPolicyId: "auth_session_membership_editor",
          },
          {
            id: "brain_pages_create_cli",
            surface: "cli",
            coverageTag: "@covers_brain_pages_create_cli",
            authPolicyId: "auth_api_key_workspace_write",
          },
        ],
        typedErrors: [],
        idempotent: false,
        argsSchemaName: "brain.pages.createMarkdown.args",
        returnsSchemaName: "brain.pages.createMarkdown.returns",
      },
    ]);

    expect(manifestPublicSurfaces(manifest)).toEqual([
      {
        id: "brain_pages_create_cli",
        transport: "cli",
        coverageTag: "@covers_brain_pages_create_cli",
        authPolicyId: "auth_api_key_workspace_write",
        authority: {
          kind: "convex-function",
          registrationLocator: "brain.pages.createMarkdown",
        },
      },
      {
        id: "brain_pages_create_ui",
        transport: "ui",
        coverageTag: "@covers_brain_pages_create_ui",
        authPolicyId: "auth_session_membership_editor",
        authority: {
          kind: "convex-function",
          registrationLocator: "brain.pages.createMarkdown",
        },
      },
    ]);

    const entry = manifest.functions[0];
    if (entry === undefined) throw new Error("fixture manifest is empty");

    expect(
      manifestPublicSurfaces({
        ...manifest,
        functions: [
          {
            ...entry,
            surfaceRegistrations: [
              {
                id: "closed_by_default",
                surface: "web",
                coverageTag: "@covers_closed_by_default",
              },
            ],
          },
        ],
      }),
    ).toMatchObject([{ authPolicyId: "auth_deny_all" }]);
  });

  it("rejects registrations for undeclared operation surfaces", () => {
    const manifest = buildContractManifest([
      {
        namespace: "brain.pages",
        name: "list",
        operationId: "brain.pages.list",
        kind: "query",
        surfaces: ["web"],
        surfaceRegistrations: [
          {
            id: "brain_pages_list_cli",
            surface: "cli",
            coverageTag: "@covers_brain_pages_list_cli",
          },
        ],
        typedErrors: [],
        idempotent: true,
        argsSchemaName: "brain.pages.list.args",
        returnsSchemaName: "brain.pages.list.returns",
      },
    ]);

    expect(() => manifestPublicSurfaces(manifest)).toThrow(
      "brain.pages.list registers undeclared surface cli",
    );
  });
});
