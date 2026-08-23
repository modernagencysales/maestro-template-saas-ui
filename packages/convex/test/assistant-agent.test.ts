import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import assistant, {
  AssistantError,
  AssistantMessage,
  ContinueThreadArgs,
  ListThreadMessagesArgs,
  StartThreadArgs,
  verifyWorkspaceAccess,
} from "../confect/agents/assistant.spec";
import assistantImpl from "../confect/agents/assistant.impl";
import { createAssistantLanguageModel } from "../confect/agents/assistantModel";

describe("assistant agent Confect entrypoints", () => {
  it("declares startThread, continueThread, and listThreadMessages contracts", () => {
    expect(JSON.stringify(assistant)).toContain("startThread");
    expect(JSON.stringify(assistant)).toContain("continueThread");
    expect(JSON.stringify(assistant)).toContain("listThreadMessages");
    expect(JSON.stringify(assistant)).toContain("public");
  });

  it("validates thread args and message return shape", () => {
    expect(
      Schema.decodeUnknownSync(StartThreadArgs)({
        workspaceId: "workspace_123",
        firstMessage: "Create a source-grounded brief.",
      }),
    ).toMatchObject({
      workspaceId: "workspace_123",
      firstMessage: "Create a source-grounded brief.",
    });
    expect(
      Schema.decodeUnknownSync(ContinueThreadArgs)({
        workspaceId: "workspace_123",
        threadId: "thread_123",
        message: "Continue.",
        idempotencyKey: "turn-001",
      }),
    ).toMatchObject({ threadId: "thread_123" });
    expect(
      Schema.decodeUnknownSync(ListThreadMessagesArgs)({
        workspaceId: "workspace_123",
        threadId: "thread_123",
      }),
    ).toMatchObject({ threadId: "thread_123" });
    expect(
      Schema.decodeUnknownSync(AssistantMessage)({
        id: "msg_1",
        role: "assistant",
        content: "Done.",
        createdAt: 1,
      }),
    ).toMatchObject({ role: "assistant" });
  });

  it("does not accept a caller user id for authorization", () => {
    const decoded = Schema.decodeUnknownSync(StartThreadArgs)({
      workspaceId: "workspace_123",
      userId: "impersonated-user",
      firstMessage: "Hello",
    });
    expect(decoded).not.toHaveProperty("userId");
  });

  it("declares typed errors for access, thread, tool, and validation failures", () => {
    const encoded = [
      new AssistantError.Unauthenticated(),
      new AssistantError.NoWorkspaceAccess({
        workspaceId: "workspace_123",
        userId: "user_123",
      }),
      new AssistantError.ThreadNotFound({ threadId: "thread_123" }),
      new AssistantError.ToolGrantDenied({
        toolName: "sourceGroundedBrief",
        grantId: "capability.run",
      }),
      new AssistantError.ValidationFailed({
        field: "message",
        message: "Message is required.",
      }),
    ].map((error) => Schema.encodeSync(AssistantError.Schema)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "Unauthenticated",
      "NoWorkspaceAccess",
      "ThreadNotFound",
      "ToolGrantDenied",
      "ValidationFailed",
    ]);
  });

  it("re-verifies workspace access for every assistant operation", () => {
    expect(
      verifyWorkspaceAccess({
        workspaceId: "workspace_123",
        userId: "user_123",
        memberships: [
          {
            workspaceId: "workspace_123",
            userId: "user_123",
            status: "active",
          },
        ],
      }),
    ).toEqual({ ok: true });
    expect(
      verifyWorkspaceAccess({
        workspaceId: "workspace_123",
        userId: "user_123",
        memberships: [],
      }),
    ).toEqual({
      ok: false,
      error: new AssistantError.NoWorkspaceAccess({
        workspaceId: "workspace_123",
        userId: "user_123",
      }),
    });
  });

  it("exports a finalized Confect implementation", () => {
    expect(Layer.isLayer(assistantImpl)).toBe(true);
  });

  it("uses a deterministic fake model and fails closed for live mode", () => {
    expect(
      createAssistantLanguageModel({ mode: "fake", env: {} }),
    ).toMatchObject({
      provider: "maestro-fake",
      modelId: "maestro-assistant-fake",
    });
    expect(() =>
      createAssistantLanguageModel({ mode: "live", env: {} }),
    ).toThrow("Live assistant provider configuration is missing");
  });
});
