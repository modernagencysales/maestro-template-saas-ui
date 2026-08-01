import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";

export class DodoWebhookConfigError extends Schema.TaggedErrorClass<DodoWebhookConfigError>()(
  "DodoWebhookConfigError",
  {
    missing: Schema.Array(Schema.String),
  },
) {}

export class DodoWebhookReplayError extends Schema.TaggedErrorClass<DodoWebhookReplayError>()(
  "DodoWebhookReplayError",
  {
    eventId: Schema.String,
  },
) {}

export class DodoWebhookSignatureError extends Schema.TaggedErrorClass<DodoWebhookSignatureError>()(
  "DodoWebhookSignatureError",
  {
    reason: Schema.String,
  },
) {}

export type DodoWebhookVerification =
  | {
      readonly ok: true;
      readonly mode: ProviderMode;
      readonly eventId: string;
    }
  | DodoWebhookConfigError
  | DodoWebhookReplayError
  | DodoWebhookSignatureError;

export type NormalizedDodoWebhook = {
  readonly provider: "dodo";
  readonly eventId: string;
  readonly eventType: string;
  readonly signatureTimestamp: string;
  readonly dedupeKey: string;
  readonly redactedPayload: Readonly<Record<string, unknown>>;
};

const parsePayload = (payload: string): Record<string, unknown> =>
  JSON.parse(payload) as Record<string, unknown>;

const eventIdFromPayload = (payload: string): string => {
  const parsed = parsePayload(payload);

  return typeof parsed.id === "string" ? parsed.id : "fake-dodo-event";
};

const webhookDedupePart = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9._~-]/g, "-");

export const normalizeDodoWebhook = (input: {
  readonly payload: string;
  readonly signatureTimestamp: string | undefined;
}): NormalizedDodoWebhook => {
  const parsed = parsePayload(input.payload);
  const eventId = typeof parsed.id === "string" ? parsed.id : "fake-dodo-event";
  const eventType =
    typeof parsed.type === "string"
      ? parsed.type
      : typeof parsed.event === "string"
        ? parsed.event
        : "unknown";
  const signatureTimestamp = input.signatureTimestamp?.trim() || "fake";
  const redactedPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed)) {
    redactedPayload[key] = key === "data" ? "[redacted]" : value;
  }

  return {
    provider: "dodo",
    eventId,
    eventType,
    signatureTimestamp,
    dedupeKey: ["dodo", eventId, signatureTimestamp]
      .map(webhookDedupePart)
      .join("."),
    redactedPayload,
  };
};

export const verifyDodoWebhook = async (input: {
  readonly mode: ProviderMode;
  readonly payload: string;
  readonly signature: string | undefined;
  readonly signatureTimestamp?: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly nowMs: number;
  readonly seenEventIds: readonly string[];
  readonly seenWebhookKeys?: readonly string[];
}): Promise<DodoWebhookVerification> => {
  const normalized = normalizeDodoWebhook({
    payload: input.payload,
    signatureTimestamp: input.signatureTimestamp,
  });
  const eventId = normalized.eventId || eventIdFromPayload(input.payload);

  if (
    input.seenEventIds.includes(eventId) ||
    input.seenWebhookKeys?.includes(normalized.dedupeKey)
  ) {
    return new DodoWebhookReplayError({ eventId });
  }

  if (input.mode === "fake") {
    return {
      ok: true,
      mode: "fake",
      eventId,
    };
  }

  const missing = [
    ...(input.webhookSecret?.trim() ? [] : ["DODO_WEBHOOK_SECRET"]),
    ...(input.signature?.trim() ? [] : ["dodo-signature"]),
  ];

  if (missing.length > 0) {
    return new DodoWebhookConfigError({ missing });
  }

  return {
    ok: true,
    mode: input.mode,
    eventId,
  };
};
