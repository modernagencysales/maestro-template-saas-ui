import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateTemplateSecurityPosture,
  type SecurityFixtureFiles,
} from "./check-auth-demo-bypass.mts";

async function withFixtureRepo<T>(
  files: SecurityFixtureFiles,
  run: (repoRoot: string) => Promise<T>,
): Promise<T> {
  const repoRoot = await mkdtemp(join(tmpdir(), "maestro-security-gate-"));

  try {
    for (const [path, contents] of Object.entries(files)) {
      const fullPath = join(repoRoot, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, contents);
    }

    return await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

const safeFiles: SecurityFixtureFiles = {
  "apps/web/vite.config.ts": `
    import { defineConfig } from "vite";
    export default defineConfig({ build: { sourcemap: false } });
  `,
  "packages/convex/confect/http.ts": `
    export const handleTemplateHttpRequest = async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/openapi.json") return new Response("docs");
      const apiEntry = buildApiCatalog().find((entry) => entry.path === url.pathname);
      if (apiEntry) return runTemplateApiOperation(apiEntry.operationId, {});
      return new Response("Unknown template HTTP route");
    };
  `,
  "packages/convex/confect/access/members.impl.ts": `
    export const loadMembership = (reader, workspaceId, userId) =>
      reader.table("workspaceMembers").index("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId),
      );
  `,
  "packages/convex/confect/access/auth.ts": `
    export const deriveActor = (identity) => ({ subjectId: identity.subject });
  `,
};

describe("check:auth-demo-bypass security posture scan", () => {
  it("passes when runtime auth, workspace joins, HTTP routing, and source maps are guarded", async () => {
    await withFixtureRepo(safeFiles, async (repoRoot) => {
      const result = await evaluateTemplateSecurityPosture(repoRoot);

      expect(result).toEqual({ ok: true, failures: [] });
    });
  });

  it("rejects runtime auth bypass switches", async () => {
    await withFixtureRepo(
      {
        ...safeFiles,
        "packages/convex/confect/access/auth.ts": `
          export const authBypass = process.env.AUTH_BYPASS === "true";
        `,
      },
      async (repoRoot) => {
        const result = await evaluateTemplateSecurityPosture(repoRoot);

        expect(result.ok).toBe(false);
        expect(result.failures.join("\n")).toContain("auth bypass");
      },
    );
  });

  it("rejects workspace-member queries that are not scoped by workspace", async () => {
    await withFixtureRepo(
      {
        ...safeFiles,
        "packages/convex/confect/access/members.impl.ts": `
          export const loadMembership = (reader, userId) =>
            reader.table("workspaceMembers").index("by_user", (q) =>
              q.eq("userId", userId),
            );
        `,
      },
      async (repoRoot) => {
        const result = await evaluateTemplateSecurityPosture(repoRoot);

        expect(result.ok).toBe(false);
        expect(result.failures.join("\n")).toContain("workspace guard");
      },
    );
  });

  it("rejects HTTP handlers whose final not-found branch runs before API route dispatch", async () => {
    await withFixtureRepo(
      {
        ...safeFiles,
        "packages/convex/confect/http.ts": `
          export const handleTemplateHttpRequest = async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/api/openapi.json") return new Response("docs");
            return new Response("Unknown template HTTP route");
            const apiEntry = buildApiCatalog().find((entry) => entry.path === url.pathname);
            if (apiEntry) return runTemplateApiOperation(apiEntry.operationId, {});
          };
        `,
      },
      async (repoRoot) => {
        const result = await evaluateTemplateSecurityPosture(repoRoot);

        expect(result.ok).toBe(false);
        expect(result.failures.join("\n")).toContain("fail closed after");
      },
    );
  });

  it("rejects HTTP handlers that only declare the dispatch helper before not-found", async () => {
    await withFixtureRepo(
      {
        ...safeFiles,
        "packages/convex/confect/http.ts": `
          const runTemplateApiOperation = async () => ({ ok: true });
          export const handleTemplateHttpRequest = async (request: Request) => {
            const url = new URL(request.url);
            if (url.pathname === "/api/openapi.json") return new Response("docs");
            const apiEntry = buildApiCatalog().find((entry) => entry.path === url.pathname);
            return new Response("Unknown template HTTP route");
          };
        `,
      },
      async (repoRoot) => {
        const result = await evaluateTemplateSecurityPosture(repoRoot);

        expect(result.ok).toBe(false);
        expect(result.failures.join("\n")).toContain(
          "dispatch docs/API routes",
        );
      },
    );
  });

  it("rejects public production source maps", async () => {
    await withFixtureRepo(
      {
        ...safeFiles,
        "apps/web/vite.config.ts": `
          import { defineConfig } from "vite";
          export default defineConfig({ build: { sourcemap: true } });
        `,
      },
      async (repoRoot) => {
        const result = await evaluateTemplateSecurityPosture(repoRoot);

        expect(result.ok).toBe(false);
        expect(result.failures.join("\n")).toContain("source maps");
      },
    );
  });

  it("rejects runtime code that reads generated admission outside the two guard adapters", async () => {
    await withFixtureRepo(
      {
        ...safeFiles,
        "apps/web/src/features/draft.ts": `
          import { admittedJourneys } from "@maestro-template/template-core/generated/admittedJourneys";
          export const enabled = admittedJourneys.journey_draft;
        `,
      },
      async (repoRoot) => {
        const result = await evaluateTemplateSecurityPosture(repoRoot);

        expect(result.ok).toBe(false);
        expect(result.failures.join("\n")).toContain(
          "generated admission may only be read by",
        );
      },
    );
  });
});
