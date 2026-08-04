import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import convexSchema from "../confect/_generated/convexSchema";

const modules = import.meta.glob("../convex/**/*.ts");
const authorizeRef = makeFunctionReference<"query">(
  "httpAuthorization:authorize",
);
const backfillRef = makeFunctionReference<"mutation">(
  "httpAuthorization:backfillTokenIdentifiers",
);

describe("HTTP API-key tenant authorization", () => {
  it.each([
    ["archived workspace", "archived", "active"],
    ["suspended organization", "active", "suspended"],
  ] as const)(
    "rejects an API key for an %s",
    async (_name, workspaceStatus, organizationStatus) => {
      const t = convexTest(convexSchema, modules);
      const ids = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          subject: "creator",
          tokenIdentifier: "https://issuer.example|creator",
          email: "creator@example.com",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        });
        const organizationId = await ctx.db.insert("organizations", {
          ownerUserId: userId,
          slug: "tenant",
          name: "Tenant",
          status: organizationStatus,
          createdAt: 1,
          updatedAt: 1,
        });
        const workspaceId = await ctx.db.insert("workspaces", {
          organizationId,
          ownerUserId: userId,
          slug: "workspace",
          name: "Workspace",
          status: workspaceStatus,
          dataClassification: "internal",
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("organizationMembers", {
          organizationId,
          userId,
          role: "admin",
          status: "active",
          acceptedAt: 1,
          revokedAt: null,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("workspaceMembers", {
          workspaceId,
          userId,
          role: "admin",
          status: "active",
          acceptedAt: 1,
          revokedAt: null,
          deletedAt: null,
          createdAt: 1,
          updatedAt: 1,
        });
        const apiKeyId = await ctx.db.insert("apiKeys", {
          id: "api_key_1",
          principalKind: "apiKey",
          principalId: "api_key_1",
          workspaceId,
          name: "CLI",
          keyHash: "hash",
          displayPrefix: "mtk_live_test",
          scopes: ["workspace:write"],
          status: "active",
          createdByUserId: userId,
          createdAt: 1,
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
        });
        return { apiKeyId, workspaceId };
      });

      await expect(
        t.query(authorizeRef, {
          operationId: "brain.pages.createMarkdown",
          workspaceId: ids.workspaceId,
          principal: { kind: "apiKey", apiKeyId: ids.apiKeyId },
        }),
      ).rejects.toThrow(/NO_WORKSPACE_ACCESS/u);
    },
  );

  it("backfills a legacy user before the field becomes required", async () => {
    const t = convexTest(convexSchema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        subject: "legacy",
        email: "legacy@example.com",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    await expect(
      t.mutation(backfillRef, {
        identities: [
          {
            userId,
            issuer: "https://issuer.example",
            subject: "legacy",
          },
        ],
      }),
    ).resolves.toEqual({ updated: 1 });
    await expect(
      t.run((ctx) => ctx.db.get("users", userId)),
    ).resolves.toMatchObject({
      tokenIdentifier: "https://issuer.example|legacy",
    });
  });
});
