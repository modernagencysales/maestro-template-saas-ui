const sensitiveKey =
  /(?:api[_-]?key|authorization|cookie|credential|password|secret|session|token)/i;
const sensitiveString =
  /(?:bearer\s+\S+|(?:api[_-]?key|authorization|cookie|credential|password|secret|session|token)\s*[:=]\s*\S+)/i;

const redact = (value: unknown, seen: WeakSet<object>): unknown => {
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "string")
    return sensitiveString.test(value) ? "[REDACTED]" : value;
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redact(nested, seen),
    ]),
  );
};

export const redactJourneyEvidence = (value: unknown): unknown =>
  redact(value, new WeakSet());

const codePointOrder = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => codePointOrder(left, right))
      .map(([key, nested]) => [key, sortKeys(nested)]),
  );
};

export const stableJourneyJson = (value: unknown): string =>
  JSON.stringify(sortKeys(redactJourneyEvidence(value)));
