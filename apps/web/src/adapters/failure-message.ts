import * as Either from "effect/Either";

export function describeTypedFailure(error: unknown, fallback: string): string {
  const extracted = unwrapTypedFailure(error);
  return extracted ?? fallback;
}

function unwrapTypedFailure(error: unknown): string | null {
  let current = error;

  while (Either.isEither(current)) {
    if (Either.isRight(current)) {
      return null;
    }
    current = current.left;
  }

  if (typeof current !== "object" || current === null) {
    return null;
  }

  for (const key of ["message", "_tag"] as const) {
    const value = current[key as keyof typeof current];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}
