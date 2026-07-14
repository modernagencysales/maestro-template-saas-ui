import type { WorkspaceSummary } from "../../providers/workspace";

export type ApiKeySettingsMetadata = {
  readonly id: string;
  readonly principalId: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly brainKey: string;
  readonly name: string;
  readonly displayPrefix: string;
  readonly scopes: readonly ("brain:read" | "brain:ask")[];
  readonly roleCeiling: "viewer";
  readonly status: "active" | "revoked" | "expired";
  readonly createdByUserId: string;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly revokedAt: number | null;
  readonly lastUsedAt: number | null;
};
import type {
  SettingsDocumentSection,
  SettingsViewer,
} from "./settings-surface";

export const buildApiKeySettingsSections = ({
  workspace,
  viewer,
  keys,
}: {
  readonly workspace: WorkspaceSummary | null;
  readonly viewer: SettingsViewer;
  readonly keys: readonly ApiKeySettingsMetadata[];
}): readonly SettingsDocumentSection[] => {
  if (!workspace) {
    return [
      {
        heading: "API keys unavailable",
        body: [
          "API keys require a server-derived active workspace and Brain scope.",
        ],
      },
    ];
  }

  const canAdminister = viewer.role === "admin" || viewer.role === "owner";
  const overview: SettingsDocumentSection = {
    heading: "Brain API keys",
    body: [
      canAdminister
        ? "Admins can create expiring, viewer-ceiling keys for one Brain."
        : "API key creation, rotation, and revocation are hidden for non-admin roles.",
      "Secrets are displayed once at creation; settings only renders prefixes and metadata.",
    ],
  };

  return [overview, ...keys.map(renderKeySection)];
};

const renderKeySection = (
  key: ApiKeySettingsMetadata,
): SettingsDocumentSection => ({
  heading: key.name,
  body: [
    `Brain: ${key.brainKey}`,
    `Scopes: ${key.scopes.join(", ")}`,
    `Role ceiling: ${key.roleCeiling}`,
    `Status: ${key.status}`,
    `Prefix: ${key.displayPrefix}`,
    key.expiresAt === null ? "Expires: missing" : `Expires: ${key.expiresAt}`,
  ],
});
