import type { PublicSurface } from "./publicSurface";

export const publicSurfaceRegistrations = [
  {
    id: "surface_contract_runtime_identity_cli",
    transport: "cli",
    coverageTag: "@covers_contract_runtime_identity_cli",
    authPolicyId: "auth_api_key_workspace_read",
    authority: {
      kind: "command",
      registrationLocator: "identity",
    },
  },
] as const satisfies readonly PublicSurface[];
