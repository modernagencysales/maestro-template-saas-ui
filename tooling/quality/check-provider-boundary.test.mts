import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateProviderBoundary } from "./check-provider-boundary.mts";

type FixtureFiles = Record<string, string>;

async function withTempRepo<T>(
  files: FixtureFiles,
  run: (repoRoot: string) => Promise<T>,
): Promise<T> {
  const repoRoot = await mkdtemp(join(tmpdir(), "provider-boundary-"));

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

async function evaluateFixture(files: FixtureFiles) {
  return await withTempRepo(files, evaluateProviderBoundary);
}

describe("check:provider-boundary", () => {
  it("rejects provider SDK imports in web feature code", async () => {
    const result = await evaluateFixture({
      "apps/web/src/features/Bad.tsx": `
        import { OpenAI } from "openai";

        export const client = new OpenAI();
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "apps/web/src/features/Bad.tsx",
        module: "openai",
      }),
    );
  });

  it("rejects provider SDK imports in backend package code", async () => {
    const result = await evaluateFixture({
      "packages/template-core/src/bad.ts": `
        import Stripe from "stripe";

        export const provider = Stripe;
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "packages/template-core/src/bad.ts",
        module: "stripe",
      }),
    );
  });

  it("detects provider re-exports and require calls", async () => {
    const result = await evaluateFixture({
      "packages/workflow-ui/src/bad.ts": `
        export { PostHog } from "@posthog/convex";
        const resend = require("resend");
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: "@posthog/convex" }),
        expect.objectContaining({ module: "resend" }),
      ]),
    );
  });

  it("allows provider SDKs in approved adapter and provider boundary packages", async () => {
    const result = await evaluateFixture({
      "packages/integrations/src/llm.ts": `
        import { openai } from "@ai-sdk/openai";
      `,
      "packages/notifications/src/email.ts": `
        import { MailerSend } from "mailersend";
      `,
      "packages/observability/src/sentry.ts": `
        import * as Sentry from "@sentry/node";
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("allows explicit runtime/auth boundary files", async () => {
    const result = await evaluateFixture({
      "apps/web/src/lib/auth/route-auth.ts": `
        import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";
      `,
      "apps/web/src/lib/auth/workos-auth-catch-all.ts": `
        import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";
      `,
      "apps/web/src/lib/auth/workos-auth-entry.ts": `
        import { createAuthService } from "@workos/authkit-session";
      `,
      "apps/web/src/lib/auth/workos-auth-loader.ts": `
        import { getAuthKitContext } from "@workos/authkit-tanstack-react-start";
      `,
      "apps/web/src/lib/auth/workos-auth.ts": `
        import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
      `,
      "apps/web/src/lib/auth/workos-cookie-session-storage.ts": `
        import { CookieSessionStorage } from "@workos/authkit-session";
      `,
      "apps/web/src/lib/auth/workos-logout.ts": `
        import { createAuthService } from "@workos/authkit-session";
      `,
      "apps/web/src/routes/__root.tsx": `
        import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
      `,
      "apps/web/src/routes/api/auth/callback.tsx": `
        import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";
      `,
      "apps/web/src/routes/api/auth/sign-in.tsx": `
        import { createAuthService } from "@workos/authkit-session";
      `,
      "apps/web/src/routes/api/auth/sign-up.tsx": `
        import { createAuthService } from "@workos/authkit-session";
      `,
      "apps/web/src/start.ts": `
        import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";
      `,
      "packages/convex/convex/convex.config.ts": `
        import posthog from "@posthog/convex/convex.config.js";
      `,
      "packages/convex/confect/agents/assistantModel.ts": `
        import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
      `,
      "packages/convex/confect/observability/posthog.ts": `
        import { PostHog } from "@posthog/convex";
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("ignores tests while scanning product roots", async () => {
    const result = await evaluateFixture({
      "apps/web/src/provider.test.ts": `
        import { OpenAI } from "openai";
        export const fixture = OpenAI;
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("ignores generated build output", async () => {
    const result = await evaluateFixture({
      "apps/web/.output/server/index.js": `
        import { createAuthService } from "@workos/authkit-session";
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });
});
