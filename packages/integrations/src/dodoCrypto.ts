const base64Alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const alphabetAt = (index: number): string => base64Alphabet.at(index) ?? "";

const encodeChunk = (
  first: number,
  second: number | undefined,
  third: number | undefined,
): string => {
  const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
  return [
    alphabetAt((combined >> 18) & 63),
    alphabetAt((combined >> 12) & 63),
    second === undefined ? "=" : alphabetAt((combined >> 6) & 63),
    third === undefined ? "=" : alphabetAt(combined & 63),
  ].join("");
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += 3)
    chunks.push(
      encodeChunk(bytes[index] ?? 0, bytes[index + 1], bytes[index + 2]),
    );
  return chunks.join("");
};

export const hmacSha256Base64 = async (secret: string, value: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return bytesToBase64(new Uint8Array(signature));
};

export const constantTimeStringEqual = (
  left: string,
  right: string,
): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};
