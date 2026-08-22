import { constantTimeEqual, hmacSha256Base64Url } from "../shared/tokenCrypto";

const tokenVersion = "v1";
const tokenLifetimeMs = 180 * 24 * 60 * 60 * 1_000;

export const createEmailUnsubscribeToken = async (input: {
  readonly subscriberId: string;
  readonly secret: string;
  readonly now?: number;
}): Promise<string> => {
  const expiresAt = (input.now ?? Date.now()) + tokenLifetimeMs;
  const payload = `${tokenVersion}.${input.subscriberId}.${String(expiresAt)}`;
  const signature = await hmacSha256Base64Url(input.secret, payload);

  return `${payload}.${signature}`;
};

export const verifyEmailUnsubscribeToken = async (input: {
  readonly token: string;
  readonly secret: string;
  readonly now?: number;
}): Promise<{ readonly subscriberId: string } | null> => {
  const [version, subscriberId, expiresAtText, signature, ...extra] =
    input.token.split(".");
  if (
    version !== tokenVersion ||
    !subscriberId ||
    !expiresAtText ||
    !signature ||
    extra.length > 0
  ) {
    return null;
  }
  const expiresAt = Number(expiresAtText);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= (input.now ?? Date.now())
  ) {
    return null;
  }
  const payload = `${version}.${subscriberId}.${expiresAtText}`;
  const expected = await hmacSha256Base64Url(input.secret, payload);

  return constantTimeEqual(expected, signature) ? { subscriberId } : null;
};
