import { describe, expect, it } from "vitest";

import { createPostmarkEmailProvider } from "./email";

describe("provider-neutral Postmark email", () => {
  it("maps transactional templates to outbound without sensitive tracking", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const provider = createPostmarkEmailProvider({
      token: "server-token",
      transactionalFrom: "Access <access@example.com>",
      marketingFrom: "Updates <updates@example.com>",
      fetch: (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Promise.resolve(
          Response.json({
            ErrorCode: 0,
            Message: "OK",
            MessageID: "message-1",
          }),
        );
      },
    });

    await expect(
      provider.sendTransactional({
        to: "person@example.com",
        templateAlias: "workspace-invitation",
        templateModel: { workspace_name: "Acme" },
        idempotencyKey: "invitation.invitation-1",
      }),
    ).resolves.toEqual({ messageId: "message-1" });
    expect(requestBody).toMatchObject({
      MessageStream: "outbound",
      TrackOpens: false,
      TrackLinks: "None",
      Metadata: { idempotencyKey: "invitation.invitation-1" },
    });
  });

  it("maps marketing templates to broadcast and keeps per-recipient results", async () => {
    let requestBody: readonly Record<string, unknown>[] = [];
    const provider = createPostmarkEmailProvider({
      token: "server-token",
      transactionalFrom: "Access <access@example.com>",
      marketingFrom: "Updates <updates@example.com>",
      replyTo: "help@example.com",
      fetch: (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as readonly Record<
          string,
          unknown
        >[];
        return Promise.resolve(
          Response.json([
            { ErrorCode: 0, Message: "OK", MessageID: "message-1" },
            { ErrorCode: 406, Message: "Inactive recipient", MessageID: null },
          ]),
        );
      },
    });

    const results = await provider.sendBroadcast([
      {
        recipientKey: "subscriber-1",
        to: "one@example.com",
        templateAlias: "simple-broadcast",
        templateModel: { subject: "News" },
        campaignId: "campaign-1",
        unsubscribeUrl: "https://example.com/unsubscribe/one",
      },
      {
        recipientKey: "subscriber-2",
        to: "two@example.com",
        templateAlias: "simple-broadcast",
        templateModel: { subject: "News" },
        campaignId: "campaign-1",
        unsubscribeUrl: "https://example.com/unsubscribe/two",
      },
    ]);

    expect(requestBody[0]).toMatchObject({
      MessageStream: "broadcast",
      ReplyTo: "help@example.com",
      Metadata: { campaignId: "campaign-1", recipientKey: "subscriber-1" },
    });
    expect(results).toEqual([
      {
        recipientKey: "subscriber-1",
        status: "accepted",
        messageId: "message-1",
      },
      {
        recipientKey: "subscriber-2",
        status: "permanent_failure",
        errorCode: 406,
        message: "Inactive recipient",
      },
    ]);
  });

  it("classifies rate limits and service failures as retryable", async () => {
    const provider = createPostmarkEmailProvider({
      token: "server-token",
      transactionalFrom: "Access <access@example.com>",
      marketingFrom: "Updates <updates@example.com>",
      fetch: () =>
        Promise.resolve(Response.json({ Message: "Busy" }, { status: 503 })),
    });

    await expect(
      provider.sendTransactional({
        to: "person@example.com",
        templateAlias: "workspace-invitation",
        templateModel: {},
        idempotencyKey: "invitation.invitation-1",
      }),
    ).rejects.toMatchObject({
      retryable: true,
      status: 503,
    });
  });
});
