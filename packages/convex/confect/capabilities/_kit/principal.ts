import * as Schema from "effect/Schema";
import { Id } from "../../_generated/id";

export const Surface = Schema.Literals([
  "web",
  "api",
  "cli",
  "mcp",
  "workflow",
  "internal",
]);
export type Surface = Schema.Schema.Type<typeof Surface>;

export const UserPrincipal = Schema.Struct({
  kind: Schema.Literal("user"),
  userId: Id("users"),
  subject: Schema.String,
  surface: Surface,
});

export const ApiKeyPrincipal = Schema.Struct({
  kind: Schema.Literal("apiKey"),
  apiKeyId: Id("apiKeys"),
  workspaceId: Id("workspaces"),
  surface: Schema.Literals(["api", "cli", "mcp"]),
});

export const SystemPrincipal = Schema.Struct({
  kind: Schema.Literal("system"),
  name: Schema.String,
  surface: Schema.Literals(["workflow", "internal"]),
});

export const Principal = Schema.Union([
  UserPrincipal,
  ApiKeyPrincipal,
  SystemPrincipal,
]);
export type Principal = Schema.Schema.Type<typeof Principal>;
