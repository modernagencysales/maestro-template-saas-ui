export type AnonymousReportCredentials = {
  readonly sessionId: string;
  readonly accessToken: string;
};

const accessPrefix = "maestro.idea-funnel.report-access.";
const ownerKey = "maestro.idea-funnel.owner-access";
const fakeVerificationPrefix = "maestro.idea-funnel.fake-verification.";

export const createAnonymousReportCredentials = (
  nonce: () => string = () => crypto.randomUUID(),
): AnonymousReportCredentials => ({
  sessionId: `session_${nonce()}`,
  accessToken: `access_${nonce()}`,
});

export const saveAnonymousReportAccess = (
  reportId: string,
  credentials: AnonymousReportCredentials,
): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${accessPrefix}${reportId}`,
    JSON.stringify(credentials),
  );
};

export const loadAnonymousReportAccess = (
  reportId: string,
): AnonymousReportCredentials | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(`${accessPrefix}${reportId}`);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<AnonymousReportCredentials>;
    return typeof value.sessionId === "string" &&
      typeof value.accessToken === "string"
      ? { sessionId: value.sessionId, accessToken: value.accessToken }
      : null;
  } catch {
    return null;
  }
};

export const saveOwnerAccessToken = (token: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ownerKey, token);
};

export const loadOwnerAccessToken = (): string | null =>
  typeof window === "undefined" ? null : window.localStorage.getItem(ownerKey);

export const requestFakeReportVerification = (
  reportId: string,
  email: string,
  nonce: () => string = () => crypto.randomUUID(),
): string => {
  if (!email.trim().includes("@"))
    throw new Error("A valid email is required.");
  const token = `verify_${nonce()}`;
  window.localStorage.setItem(`${fakeVerificationPrefix}${token}`, reportId);
  return `/verify-report?token=${encodeURIComponent(token)}&mode=fake`;
};

export const consumeFakeReportVerification = (
  token: string,
  nonce: () => string = () => crypto.randomUUID(),
): { readonly reportId: string; readonly ownerAccessToken: string } | null => {
  const key = `${fakeVerificationPrefix}${token}`;
  const reportId = window.localStorage.getItem(key);
  if (!reportId) return null;
  window.localStorage.removeItem(key);
  const ownerAccessToken = `owner_${nonce()}`;
  saveOwnerAccessToken(ownerAccessToken);
  return { reportId, ownerAccessToken };
};
