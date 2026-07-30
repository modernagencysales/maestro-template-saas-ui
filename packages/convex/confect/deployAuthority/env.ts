import { env as convexEnv } from "../../convex/_generated/server";

const readConvexEnvString = (name: string): string | undefined => {
  const value: unknown = Reflect.get(convexEnv, name);
  return typeof value === "string" ? value : undefined;
};

export const readPromotionAuthorityPrivateKeyPkcs8Base64Url = () =>
  readConvexEnvString("PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL");

export const readPromotionAuthorityMode = (): "authority" | undefined =>
  readConvexEnvString("PROMOTION_AUTHORITY_MODE") === "authority"
    ? "authority"
    : undefined;
