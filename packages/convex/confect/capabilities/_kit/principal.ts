import * as Schema from "effect/Schema";
import { Id } from "../../_generated/id";

export const Surface = Schema.Literals([
  "web",
  "api",
  "cli",
  "mcp",
  "webhook",
  "workflow",
  "internal",
]);
export type Surface = Schema.Schema.Type<typeof Surface>;

export const UserPrincipal = Schema.Struct({
  kind: Schema.Literal("user"),
  userId: Id("users"),
  subject: Schema.String,
  surface: Schema.Literal("web"),
});

export const ApiKeyPrincipal = Schema.Struct({
  kind: Schema.Literal("apiKey"),
  apiKeyId: Id("apiKeys"),
  workspaceId: Id("workspaces"),
  scopes: Schema.Array(Schema.String),
  surface: Schema.Literals(["api", "cli", "mcp"]),
});
export type ApiKeyPrincipal = Schema.Schema.Type<typeof ApiKeyPrincipal>;

export const AnonymousPrincipal = Schema.Struct({
  kind: Schema.Literal("anonymous"),
  surface: Schema.Literals(["web", "api"]),
});

export type AnonymousPrincipal = Schema.Schema.Type<typeof AnonymousPrincipal>;

export const SystemPrincipal = Schema.Struct({
  kind: Schema.Literal("system"),
  name: Schema.String,
  surface: Schema.Literals(["webhook", "workflow", "internal"]),
});

export const Principal = Schema.Union([
  UserPrincipal,
  ApiKeyPrincipal,
  AnonymousPrincipal,
  SystemPrincipal,
]);
export type Principal = Schema.Schema.Type<typeof Principal>;
