const sensitiveKey = /(?:api[_-]?key|credential|password|secret|token)/i;

export const redactJourneyEvidence = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactJourneyEvidence);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactJourneyEvidence(nested),
    ]),
  );
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortKeys(nested)]),
  );
};

export const stableJourneyJson = (value: unknown): string =>
  JSON.stringify(sortKeys(redactJourneyEvidence(value)));
