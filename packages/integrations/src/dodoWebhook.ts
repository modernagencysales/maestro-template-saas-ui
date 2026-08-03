import type { ProviderMode } from "./providerRegistry";
import {
  DodoWebhookConfigError,
  DodoWebhookEventIdError,
  DodoWebhookPayloadError,
  DodoWebhookReplayError,
  DodoWebhookSignatureError,
  type DodoWebhookVerification,
} from "./dodo";
import { constantTimeStringEqual, hmacSha256Base64 } from "./dodoCrypto";

export type NormalizedDodoWebhook = {
  readonly provider: "dodo";
  readonly eventId: string;
  readonly eventType: string;
  readonly signatureTimestamp: string;
  readonly dedupeKey: string;
  readonly redactedPayload: Readonly<Record<string, unknown>>;
};

export const normalizeDodoWebhook = (input: {
  readonly payload: string;
  readonly signatureTimestamp: string | undefined;
  readonly webhookId?: string | undefined;
}): NormalizedDodoWebhook => {
  const parsed = JSON.parse(input.payload) as Record<string, unknown>;
  const eventId =
    input.webhookId?.trim() ||
    (typeof parsed.id === "string" ? parsed.id : "fake-dodo-event");
  const eventType =
    typeof parsed.type === "string"
      ? parsed.type
      : typeof parsed.event === "string"
        ? parsed.event
        : "unknown";
  const signatureTimestamp = input.signatureTimestamp?.trim() || "fake";
  return {
    provider: "dodo",
    eventId,
    eventType,
    signatureTimestamp,
    dedupeKey: ["dodo", eventId, signatureTimestamp]
      .map((value) => value.replaceAll(/[^A-Za-z0-9._~-]/g, "-"))
      .join("."),
    redactedPayload: Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        key === "data" ? "[redacted]" : value,
      ]),
    ),
  };
};

const normalizePayload = (input: Parameters<typeof verifyDodoWebhook>[0]) => {
  try {
    return normalizeDodoWebhook({
      payload: input.payload,
      signatureTimestamp: input.signatureTimestamp,
      webhookId: input.webhookId,
    });
  } catch {
    return new DodoWebhookPayloadError({ reason: "invalid-json" });
  }
};

const replayError = (
  input: Parameters<typeof verifyDodoWebhook>[0],
  normalized: NormalizedDodoWebhook,
) =>
  input.seenEventIds.includes(normalized.eventId) ||
  input.seenWebhookKeys?.includes(normalized.dedupeKey)
    ? new DodoWebhookReplayError({ eventId: normalized.eventId })
    : undefined;

export const verifyDodoWebhook = async (input: {
  readonly mode: ProviderMode;
  readonly payload: string;
  readonly signature: string | undefined;
  readonly signatureTimestamp?: string | undefined;
  readonly webhookId?: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly nowMs: number;
  readonly seenEventIds: readonly string[];
  readonly seenWebhookKeys?: readonly string[];
}): Promise<DodoWebhookVerification> => {
  const normalized = normalizePayload(input);
  if (normalized instanceof DodoWebhookPayloadError) return normalized;
  const replay = replayError(input, normalized);
  if (input.mode === "fake")
    return replay ?? { ok: true, mode: "fake", eventId: normalized.eventId };
  const missing = [
    ...(input.webhookSecret?.trim() ? [] : ["DODO_WEBHOOK_SECRET"]),
    ...(input.signature?.trim() ? [] : ["dodo-signature"]),
  ];
  if (missing.length > 0) return new DodoWebhookConfigError({ missing });
  const webhookId = input.webhookId?.trim();
  if (!webhookId) return new DodoWebhookEventIdError({ field: "webhook-id" });
  const timestamp = input.signatureTimestamp ?? "";
  const timestampMs = Number(timestamp) * 1_000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(input.nowMs - timestampMs) > 300_000
  )
    return new DodoWebhookSignatureError({
      reason: "timestamp-outside-window",
    });
  const expected = await hmacSha256Base64(
    input.webhookSecret ?? "",
    `${webhookId}.${timestamp}.${input.payload}`,
  );
  if (!constantTimeStringEqual(input.signature?.split(",")[1] ?? "", expected))
    return new DodoWebhookSignatureError({ reason: "invalid-signature" });
  return replay ?? { ok: true, mode: input.mode, eventId: normalized.eventId };
};
