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

type VerifyInput = {
  readonly mode: ProviderMode;
  readonly payload: string;
  readonly signature: string | undefined;
  readonly signatureTimestamp?: string | undefined;
  readonly webhookId?: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly nowMs: number;
  readonly seenEventIds: readonly string[];
  readonly seenWebhookKeys?: readonly string[];
};

const eventIdentity = (
  parsed: Record<string, unknown>,
  webhookId: string | undefined,
) => ({
  eventId:
    webhookId?.trim() ||
    (typeof parsed.id === "string" ? parsed.id : "fake-dodo-event"),
  eventType:
    typeof parsed.type === "string"
      ? parsed.type
      : typeof parsed.event === "string"
        ? parsed.event
        : "unknown",
});

const redactedPayload = (parsed: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      key === "data" ? "[redacted]" : value,
    ]),
  );

export const normalizeDodoWebhook = (input: {
  readonly payload: string;
  readonly signatureTimestamp: string | undefined;
  readonly webhookId?: string | undefined;
}): NormalizedDodoWebhook => {
  const parsed = JSON.parse(input.payload) as Record<string, unknown>;
  const { eventId, eventType } = eventIdentity(parsed, input.webhookId);
  const signatureTimestamp = input.signatureTimestamp?.trim() || "fake";
  return {
    provider: "dodo",
    eventId,
    eventType,
    signatureTimestamp,
    dedupeKey: ["dodo", eventId, signatureTimestamp]
      .map((value) => value.replaceAll(/[^A-Za-z0-9._~-]/g, "-"))
      .join("."),
    redactedPayload: redactedPayload(parsed),
  };
};

const normalizePayload = (input: VerifyInput) => {
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

const replayError = (input: VerifyInput, normalized: NormalizedDodoWebhook) =>
  input.seenEventIds.includes(normalized.eventId) ||
  input.seenWebhookKeys?.includes(normalized.dedupeKey)
    ? new DodoWebhookReplayError({ eventId: normalized.eventId })
    : undefined;

const missingWebhookInputs = (input: VerifyInput): string[] => [
  ...(input.webhookSecret?.trim() ? [] : ["DODO_WEBHOOK_SECRET"]),
  ...(input.signature?.trim() ? [] : ["dodo-signature"]),
];

const timestampIsFresh = (timestamp: string, nowMs: number): boolean => {
  const timestampMs = Number(timestamp) * 1_000;
  return (
    Number.isFinite(timestampMs) && Math.abs(nowMs - timestampMs) <= 300_000
  );
};

const signatureIsValid = async (
  input: VerifyInput,
  webhookId: string,
  timestamp: string,
): Promise<boolean> => {
  const expected = await hmacSha256Base64(
    input.webhookSecret ?? "",
    `${webhookId}.${timestamp}.${input.payload}`,
  );
  return constantTimeStringEqual(
    input.signature?.split(",")[1] ?? "",
    expected,
  );
};

const liveVerificationFailure = async (
  input: VerifyInput,
): Promise<DodoWebhookVerification | undefined> => {
  const missing = missingWebhookInputs(input);
  const webhookId = input.webhookId?.trim();
  const timestamp = input.signatureTimestamp ?? "";
  let failure: DodoWebhookVerification | undefined;
  if (missing.length > 0) failure = new DodoWebhookConfigError({ missing });
  else if (!webhookId)
    failure = new DodoWebhookEventIdError({ field: "webhook-id" });
  else if (!timestampIsFresh(timestamp, input.nowMs))
    failure = new DodoWebhookSignatureError({
      reason: "timestamp-outside-window",
    });
  else if (!(await signatureIsValid(input, webhookId, timestamp)))
    failure = new DodoWebhookSignatureError({ reason: "invalid-signature" });
  return failure;
};

export const verifyDodoWebhook = async (
  input: VerifyInput,
): Promise<DodoWebhookVerification> => {
  const normalized = normalizePayload(input);
  if (normalized instanceof DodoWebhookPayloadError) return normalized;
  const replay = replayError(input, normalized);
  if (input.mode === "fake")
    return replay ?? { ok: true, mode: "fake", eventId: normalized.eventId };
  const liveFailure = await liveVerificationFailure(input);
  if (liveFailure) return liveFailure;
  return replay ?? { ok: true, mode: input.mode, eventId: normalized.eventId };
};
