import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";
import { consumeDeployAuthority } from "../deployAuthority/store";

export const consume = internalMutationGeneric({
  args: {
    environment: v.union(v.literal("staging"), v.literal("production")),
    targetId: v.string(),
    commitSha: v.string(),
    action: v.union(
      v.literal("preflight"),
      v.literal("convex"),
      v.literal("cloudflare"),
    ),
  },
  returns: v.any(),
  handler: async (context, scope) =>
    consumeDeployAuthority(context, scope, {
      nowMs: Date.now,
      pinnedPublicKeyHash:
        "sha256:3e1bdc7e4b192e53fc11353147685865780ba36531720111b716f56366fbbeae",
    }),
});
