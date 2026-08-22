export type TransactionalEmailMessage = {
  readonly to: string;
  readonly templateAlias: string;
  readonly templateModel: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
};

export type BroadcastEmailMessage = {
  readonly recipientKey: string;
  readonly to: string;
  readonly templateAlias: string;
  readonly templateModel: Readonly<Record<string, unknown>>;
  readonly campaignId: string;
  readonly unsubscribeUrl: string;
};

export type BroadcastEmailResult =
  | {
      readonly recipientKey: string;
      readonly status: "accepted";
      readonly messageId: string;
    }
  | {
      readonly recipientKey: string;
      readonly status: "transient_failure" | "permanent_failure";
      readonly errorCode: number;
      readonly message: string;
    };

export type EmailProvider = {
  readonly sendTransactional: (
    message: TransactionalEmailMessage,
  ) => Promise<{ readonly messageId: string }>;
  readonly sendBroadcast: (
    messages: readonly BroadcastEmailMessage[],
  ) => Promise<readonly BroadcastEmailResult[]>;
};

type PostmarkResponse = {
  readonly ErrorCode?: unknown;
  readonly Message?: unknown;
  readonly MessageID?: unknown;
};

export class PostmarkEmailError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "PostmarkEmailError";
    this.status = status;
    this.retryable = retryable;
  }
}

const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500;

const cleanMessage = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 300)
    : fallback;

const postmarkHeaders = (token: string): HeadersInit => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Postmark-Server-Token": token,
});

export const createPostmarkEmailProvider = (options: {
  readonly token: string;
  readonly transactionalFrom: string;
  readonly marketingFrom: string;
  readonly replyTo?: string;
  readonly fetch?: typeof globalThis.fetch;
}): EmailProvider => {
  const request = options.fetch ?? globalThis.fetch;

  return {
    sendTransactional: async (message) => {
      const response = await request(
        "https://api.postmarkapp.com/email/withTemplate",
        {
          method: "POST",
          headers: postmarkHeaders(options.token),
          body: JSON.stringify({
            From: options.transactionalFrom,
            To: message.to,
            TemplateAlias: message.templateAlias,
            TemplateModel: message.templateModel,
            MessageStream: "outbound",
            TrackOpens: false,
            TrackLinks: "None",
            Metadata: { idempotencyKey: message.idempotencyKey },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const result = (await response.json()) as PostmarkResponse;
      const errorCode =
        typeof result.ErrorCode === "number" ? result.ErrorCode : 0;
      const messageId =
        typeof result.MessageID === "string" ? result.MessageID : "";

      if (!response.ok || errorCode !== 0 || !messageId) {
        throw new PostmarkEmailError(
          cleanMessage(result.Message, `Postmark returned ${response.status}.`),
          response.status,
          isRetryableStatus(response.status),
        );
      }

      return { messageId };
    },

    sendBroadcast: async (messages) => {
      if (messages.length === 0) {
        return [];
      }
      if (messages.length > 500) {
        throw new PostmarkEmailError(
          "A Postmark batch cannot exceed 500 recipients.",
          422,
          false,
        );
      }

      const response = await request(
        "https://api.postmarkapp.com/email/batchWithTemplates",
        {
          method: "POST",
          headers: postmarkHeaders(options.token),
          body: JSON.stringify(
            messages.map((message) => ({
              From: options.marketingFrom,
              ...(options.replyTo ? { ReplyTo: options.replyTo } : {}),
              To: message.to,
              TemplateAlias: message.templateAlias,
              TemplateModel: {
                ...message.templateModel,
                unsubscribe_url: message.unsubscribeUrl,
              },
              MessageStream: "broadcast",
              TrackOpens: true,
              TrackLinks: "HtmlAndText",
              Metadata: {
                campaignId: message.campaignId,
                recipientKey: message.recipientKey,
              },
              Headers: [
                {
                  Name: "List-Unsubscribe",
                  Value: `<${message.unsubscribeUrl}>`,
                },
                {
                  Name: "List-Unsubscribe-Post",
                  Value: "List-Unsubscribe=One-Click",
                },
              ],
            })),
          ),
          signal: AbortSignal.timeout(20_000),
        },
      );

      if (!response.ok) {
        const result = (await response.json()) as PostmarkResponse;
        throw new PostmarkEmailError(
          cleanMessage(result.Message, `Postmark returned ${response.status}.`),
          response.status,
          isRetryableStatus(response.status),
        );
      }

      const results = (await response.json()) as readonly PostmarkResponse[];
      return messages.map<BroadcastEmailResult>((message, index) => {
        const result = results[index] ?? {};
        const errorCode =
          typeof result.ErrorCode === "number" ? result.ErrorCode : 500;
        const messageId =
          typeof result.MessageID === "string" ? result.MessageID : "";

        if (errorCode === 0 && messageId) {
          return {
            recipientKey: message.recipientKey,
            status: "accepted",
            messageId,
          };
        }

        return {
          recipientKey: message.recipientKey,
          status:
            errorCode === 429 || errorCode >= 500
              ? "transient_failure"
              : "permanent_failure",
          errorCode,
          message: cleanMessage(
            result.Message,
            "Postmark rejected the recipient.",
          ),
        };
      });
    },
  };
};
