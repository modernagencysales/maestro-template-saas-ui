import { makePublicError } from "../../shared/errors";

export type JsonSafeValue =
  | null
  | string
  | boolean
  | number
  | JsonSafeValue[]
  | { [key: string]: JsonSafeValue };

export const assertJsonObject = (value: unknown, message: string): void => {
  if (!isJsonRecord(value)) {
    throw makePublicError("VALIDATION_FAILED", message);
  }
  assertJsonSafe(value, message);
};

export const assertJsonSafe: (
  value: unknown,
  message: string,
) => asserts value is JsonSafeValue = (value, message) => {
  if (!isJsonSafe(value)) {
    throw makePublicError("VALIDATION_FAILED", message);
  }
};

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const jsonSafetyChecks: readonly [
  (value: unknown) => boolean,
  (value: unknown) => boolean,
] = [
  (value) => Array.isArray(value) && value.every(isJsonSafe),
  (value) =>
    isJsonRecord(value) &&
    Object.values(value).every(
      (entry) => entry !== undefined && isJsonSafe(entry),
    ),
];

const isJsonSafe = (value: unknown): boolean =>
  isJsonPrimitive(value) ||
  jsonSafetyChecks.some((check) => check(value)) ||
  (typeof value === "number" && Number.isFinite(value));

const isJsonPrimitive = (value: unknown): boolean =>
  value === null || typeof value === "string" || typeof value === "boolean";
