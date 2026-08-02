import { constantTimeEqual, stableFingerprint } from "../shared/tokenCrypto";

export type NormalizedPostmarkEvent = {
  readonly fingerprint: string;
  readonly kind:
    | "delivery"
    | "hard_bounce"
    | "soft_bounce"
    | "spam_complaint"
    | "subscription_change"
    | "open"
    | "click";
  readonly recipient: string;
  readonly providerMessageId?: string;
};

const readString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const eventKind = (recordType: string, bounceType: string) => {
  const normalizedRecordType = recordType.toLowerCase();
  const normalizedBounceType = bounceType.toLowerCase();
  if (normalizedRecordType === "spamcomplaint")
    return "spam_complaint" as const;
  if (normalizedRecordType === "subscriptionchange")
    return "subscription_change" as const;
  if (normalizedRecordType === "delivery") return "delivery" as const;
  if (normalizedRecordType === "open") return "open" as const;
  if (normalizedRecordType === "click") return "click" as const;
  if (normalizedRecordType === "bounce") {
    return normalizedBounceType.includes("hard") ||
      normalizedBounceType.includes("spamnotification")
      ? ("hard_bounce" as const)
      : ("soft_bounce" as const);
  }
  return null;
};

export const normalizePostmarkEvent = async (
  value: unknown,
): Promise<NormalizedPostmarkEvent | null> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const input = value as Record<string, unknown>;
  const recordType = readString(input.RecordType);
  const bounceType = readString(input.Type);
  const kind = eventKind(recordType, bounceType);
  const recipient = readString(input.Email).toLowerCase();
  if (kind === null || !recipient) return null;
  const providerMessageId = readString(input.MessageID);
  const occurredAt =
    readString(input.BouncedAt) ||
    readString(input.DeliveredAt) ||
    readString(input.ReceivedAt) ||
    readString(input.ChangedAt);
  const fingerprint = await stableFingerprint({
    recordType,
    bounceType,
    recipient,
    providerMessageId,
    occurredAt,
  });

  return {
    fingerprint,
    kind,
    recipient,
    ...(providerMessageId ? { providerMessageId } : {}),
  };
};

export const verifyPostmarkBasicAuth = (input: {
  readonly authorization: string | null;
  readonly username: string | undefined;
  readonly password: string | undefined;
}): boolean => {
  if (
    !input.username ||
    !input.password ||
    !input.authorization?.startsWith("Basic ")
  ) {
    return false;
  }
  try {
    const decoded = atob(input.authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      constantTimeEqual(decoded.slice(0, separator), input.username) &&
      constantTimeEqual(decoded.slice(separator + 1), input.password)
    );
  } catch {
    return false;
  }
};
