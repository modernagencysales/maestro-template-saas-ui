import {
  Agent,
  extractText,
  getThreadMetadata,
  listMessages,
  type AgentComponent,
  type MessageDoc,
} from "@convex-dev/agent";
import { FunctionImpl, GroupImpl } from "@confect/server";
import { componentsGeneric } from "convex/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import { ActionCtx, QueryCtx, QueryRunner } from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import {
  MemberNotInWorkspace,
  Unauthorized,
  WorkspaceNotFound,
} from "../errors";
import { RuntimeModeConfig } from "../shared/config";
import { loadLlmGatewayEnvConfig } from "../shared/env";
import assistant, { AssistantError } from "./assistant.spec";
import { createAssistantLanguageModel } from "./assistantModel";

const agentComponent = componentsGeneric().agent as unknown as AgentComponent;

const withConfectClock = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const assistantAccess = (
  workspaceId: Parameters<typeof requireWorkspaceAccess>[0],
) =>
  withConfectClock(requireWorkspaceAccess(workspaceId, "viewer")).pipe(
    Effect.mapError((error) => {
      if (error instanceof Unauthorized) {
        return new AssistantError.Unauthenticated();
      }
      if (
        error instanceof MemberNotInWorkspace ||
        error instanceof WorkspaceNotFound
      ) {
        return new AssistantError.NoWorkspaceAccess({
          workspaceId,
          userId: "authenticated-user",
        });
      }
      return new AssistantError.Unauthenticated();
    }),
  );

const threadOwnerKey = (workspaceId: string, userId: string) =>
  `workspace:${workspaceId}:user:${userId}`;

const resolveAgent = Effect.gen(function* () {
  const mode = yield* RuntimeModeConfig.pipe(Effect.orDie);
  const env = yield* loadLlmGatewayEnvConfig.pipe(Effect.orDie);
  const languageModel = yield* Effect.try({
    try: () => createAssistantLanguageModel({ mode, env }),
    catch: providerUnavailable,
  });

  return new Agent(agentComponent, {
    name: "Maestro Assistant",
    languageModel,
    instructions:
      "Help the user understand and act on their workspace context. Be concise and do not invent sources.",
  });
});

const projectMessage = (message: MessageDoc) => {
  const role = message.message?.role;
  if (role !== "user" && role !== "assistant" && role !== "tool") return null;
  return {
    id: message._id,
    role,
    content:
      (message.message === undefined
        ? undefined
        : extractText(message.message)) ??
      message.text ??
      "",
    createdAt: message._creationTime,
  };
};

const readThreadMessages = async (
  ctx: Parameters<typeof listMessages>[0],
  threadId: string,
) => {
  const result = await listMessages(ctx, agentComponent, {
    threadId,
    paginationOpts: { numItems: 100, cursor: null },
  });
  return result.page.flatMap((message) => {
    const projected = projectMessage(message);
    return projected === null ? [] : [projected];
  });
};

const readThreadOwner = async (
  ctx: Parameters<typeof getThreadMetadata>[0],
  threadId: string,
) => {
  const metadata = await getThreadMetadata(ctx, agentComponent, { threadId });
  return metadata.userId;
};

const providerUnavailable = () =>
  new AssistantError.ValidationFailed({
    field: "provider",
    message: "Assistant provider is unavailable.",
  });

const resolveAccess = FunctionImpl.make(
  databaseSchema,
  assistant,
  "resolveAccess",
  ({ workspaceId }) =>
    assistantAccess(workspaceId).pipe(Effect.map(({ userId }) => ({ userId }))),
);

const resolveActionAccess = (
  workspaceId: Parameters<typeof assistantAccess>[0],
) =>
  Effect.gen(function* () {
    const query = yield* QueryRunner;
    return yield* query(refs.internal.agents.assistant.resolveAccess, {
      workspaceId,
    }).pipe(Effect.catchTag("SchemaError", () => providerUnavailable()));
  });

const startThread = FunctionImpl.make(
  databaseSchema,
  assistant,
  "startThread",
  ({ workspaceId, firstMessage }) =>
    Effect.gen(function* () {
      const access = yield* resolveActionAccess(workspaceId);
      const ctx = yield* ActionCtx;
      const runtime = yield* resolveAgent.pipe(
        Effect.mapError(providerUnavailable),
      );
      const ownerKey = threadOwnerKey(workspaceId, access.userId);
      return yield* Effect.tryPromise({
        try: async () => {
          const { threadId } = await runtime.createThread(ctx, {
            userId: ownerKey,
            title: firstMessage.slice(0, 80),
          });
          await runtime.generateText(
            ctx,
            { threadId, userId: ownerKey },
            { prompt: firstMessage },
          );
          return {
            threadId,
            messages: await readThreadMessages(ctx, threadId),
          };
        },
        catch: (error) =>
          error instanceof AssistantError.ThreadNotFound
            ? error
            : new AssistantError.ValidationFailed({
                field: "message",
                message: "Unable to start assistant thread.",
              }),
      });
    }),
);

const continueThread = FunctionImpl.make(
  databaseSchema,
  assistant,
  "continueThread",
  ({ workspaceId, threadId, message }) =>
    Effect.gen(function* () {
      const access = yield* resolveActionAccess(workspaceId);
      const ctx = yield* ActionCtx;
      const runtime = yield* resolveAgent.pipe(
        Effect.mapError(providerUnavailable),
      );
      const ownerKey = threadOwnerKey(workspaceId, access.userId);
      const storedOwner = yield* Effect.tryPromise({
        try: () => readThreadOwner(ctx, threadId),
        catch: () => new AssistantError.ThreadNotFound({ threadId }),
      });
      if (storedOwner !== ownerKey) {
        return yield* new AssistantError.ThreadNotFound({ threadId });
      }
      return yield* Effect.tryPromise({
        try: async () => {
          await runtime.generateText(
            ctx,
            { threadId, userId: ownerKey },
            { prompt: message },
          );
          return {
            threadId,
            messages: await readThreadMessages(ctx, threadId),
            toolCallCount: 0,
          };
        },
        catch: (error) =>
          error instanceof AssistantError.ThreadNotFound
            ? error
            : new AssistantError.ValidationFailed({
                field: "message",
                message: "Unable to continue assistant thread.",
              }),
      });
    }),
);

const listThreadMessages = FunctionImpl.make(
  databaseSchema,
  assistant,
  "listThreadMessages",
  ({ workspaceId, threadId }) =>
    Effect.gen(function* () {
      const access = yield* assistantAccess(workspaceId);
      const ctx = yield* QueryCtx;
      const ownerKey = threadOwnerKey(workspaceId, access.userId);
      const storedOwner = yield* Effect.tryPromise({
        try: () => readThreadOwner(ctx, threadId),
        catch: () => new AssistantError.ThreadNotFound({ threadId }),
      });
      if (storedOwner !== ownerKey) {
        return yield* new AssistantError.ThreadNotFound({ threadId });
      }
      return yield* Effect.tryPromise({
        try: async () => {
          return await readThreadMessages(ctx, threadId);
        },
        catch: (error) =>
          error instanceof AssistantError.ThreadNotFound
            ? error
            : new AssistantError.ThreadNotFound({ threadId }),
      });
    }),
);

export default GroupImpl.make(databaseSchema, assistant).pipe(
  Layer.provide(startThread),
  Layer.provide(continueThread),
  Layer.provide(listThreadMessages),
  Layer.provide(resolveAccess),
  GroupImpl.finalize,
);
