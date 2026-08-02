export const compareCodePoints = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const canonicalStringify = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      compareCodePoints(left, right),
    );
    return `{${entries
      .map(
        ([key, nested]) =>
          `${JSON.stringify(key)}:${canonicalStringify(nested)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
