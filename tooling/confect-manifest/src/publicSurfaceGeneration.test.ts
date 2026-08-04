import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PublicSurface } from "@maestro-template/template-core/publicSurface";
import {
  adoptLegacyPublicSurfaces,
  buildContractsLegacyBaseline,
  checkGeneratedPublicSurfaceInventory,
  discoverPublicAuthorities,
  generatePublicSurfaceInventory,
  verifyContractsLegacyBaseline,
  verifyLegacyBaselineTrustAnchor,
  protectedLegacyBaselineDigest,
} from "./publicSurfaceGeneration";

const fixture = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "public-surfaces-"));
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
};

const registered = (
  authority: ReturnType<typeof discoverPublicAuthorities>[number],
  index: number,
): PublicSurface => ({
  id: `surface_${String(index)}`,
  transport: authority.transport,
  coverageTag: `@covers_surface_${String(index)}`,
  authPolicyId: "auth_deny_all",
  authority: {
    kind: authority.kind,
    registrationLocator: authority.registrationLocator,
    ...(authority.actionDiscriminant === undefined
      ? {}
      : { actionDiscriminant: authority.actionDiscriminant }),
  },
});

describe("public surface generation", () => {
  it("discovers every supported public registration mechanism", () => {
    const root = fixture({
      "apps/web/src/routeTree.gen.ts": `
        export interface FileRoutesByFullPath {
          '/': unknown
          '/settings': unknown
        }
      `,
      "apps/web/src/features/settings/actions.ts": `
        const save = useTemplateMutation(templateConfectRefs.notes.create);
      `,
      "packages/convex/confect/_generated/confectManifest.inventory.ts": `
        export const confectInventoryManifest = { functions: [{
          operationId: "notes.create",
          surfaces: ["web", "api", "cli", "mcp"]
        }] } as const;
      `,
      "packages/template-core/src/generated/confectManifest.ts": `
        export const confectManifest = { functions: [{
          operationId: "notes.create",
          surfaces: ["api"]
        }] } as const;
      `,
      "packages/convex/convex/raw.ts": `
        export const lookup = query({ args: {}, handler: () => null });
      `,
      "packages/convex/confect/rawLegacy.spec.ts": `
        const lookup = FunctionSpec.publicQuery({ name: "lookup", args, returns });
        export default GroupSpec.make().addFunction(lookup);
      `,
      "packages/convex/confect/http.ts": `
        const templateHttpRoutes = [
          { path: "/api/status", method: "GET", kind: "http-route" },
          { path: "/webhooks/provider", method: "POST", kind: "webhook" },
        ];
        router.route({ path: "/deploy-authority/consume", method: "POST", handler });
      `,
      "apps/cli/src/commands.ts": `
        const matchesProject = ({ command, subcommand }) =>
          command === "project" &&
          (subcommand === "archive" || subcommand === "restore");
      `,
      "apps/cli/src/factory/doctor.ts": `
        export const doctor = { command: "doctor", run };
      `,
      "tooling/agent-pack/src/mcp/projection.ts": `
        const TOOLS = [{ name: "maestro_verify", description: "Verify" }];
      `,
      "tooling/workflow/src/index.ts": `
        const workflowRunMcpTool = { name: "template.workflow.run" };
      `,
      "packages/convex/confect/workflows/_generated/workflowRegistry.ts": `
        export const workflowPublicationRegistry = definePublicationRegistry({
          capabilities: [],
          workflows: [nightlySyncRelease],
        });
      `,
    });

    const discovered = discoverPublicAuthorities(root);
    expect(discovered).toHaveLength(18);
    expect(discovered).toEqual(
      expect.arrayContaining([
        {
          kind: "route",
          registrationLocator: "apps/web/src/routeTree.gen.ts#/",
          transport: "ui",
        },
        {
          kind: "route",
          registrationLocator: "apps/web/src/routeTree.gen.ts#/settings",
          transport: "ui",
        },
        {
          actionDiscriminant: "templateConfectRefs.notes.create",
          kind: "ui-action",
          registrationLocator: "apps/web/src/features/settings/actions.ts",
          transport: "ui",
        },
        {
          kind: "command",
          registrationLocator: "project",
          actionDiscriminant: "archive",
          transport: "cli",
        },
        {
          kind: "command",
          registrationLocator: "project",
          actionDiscriminant: "restore",
          transport: "cli",
        },
        {
          kind: "command",
          registrationLocator: "doctor",
          transport: "cli",
        },
        {
          kind: "command",
          registrationLocator: "maestro_verify",
          transport: "mcp",
        },
        {
          kind: "command",
          registrationLocator: "template.workflow.run",
          transport: "mcp",
        },
        {
          kind: "convex-function",
          registrationLocator: "notes.create",
          transport: "api",
        },
        {
          kind: "convex-function",
          registrationLocator: "notes.create",
          transport: "cli",
        },
        {
          kind: "convex-function",
          registrationLocator: "notes.create",
          transport: "mcp",
        },
        {
          kind: "convex-function",
          registrationLocator: "notes.create",
          transport: "ui",
        },
        {
          kind: "http-route",
          registrationLocator: "POST /api/notes.create",
          transport: "api",
        },
        {
          kind: "http-route",
          registrationLocator: "POST /deploy-authority/consume",
          transport: "api",
        },
        {
          kind: "http-route",
          registrationLocator: "GET /api/status",
          transport: "api",
        },
        {
          kind: "webhook",
          registrationLocator: "POST /webhooks/provider",
          transport: "webhook",
        },
        {
          kind: "convex-function",
          registrationLocator: "rawLegacy:lookup",
          transport: "api",
        },
        {
          kind: "convex-function",
          registrationLocator: "raw:lookup",
          transport: "api",
        },
      ]),
    );
    expect(discovered).toEqual(
      [...discovered].sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
    );
  });

  it("requires an exact one-to-one discovered/registered mapping", () => {
    const discovered = [
      {
        kind: "command" as const,
        registrationLocator: "deploy",
        actionDiscriminant: "preview",
        transport: "cli" as const,
      },
      {
        kind: "command" as const,
        registrationLocator: "deploy",
        actionDiscriminant: "apply",
        transport: "cli" as const,
      },
    ];
    const registrations = discovered.map(registered);

    expect(
      generatePublicSurfaceInventory({ discovered, registered: registrations }),
    ).toEqual({ surfaces: registrations });
    expect(() =>
      generatePublicSurfaceInventory({
        discovered,
        registered: registrations.slice(0, 1),
      }),
    ).toThrow("unregistered public authority");
    expect(() =>
      generatePublicSurfaceInventory({
        discovered: discovered.slice(0, 1),
        registered: registrations,
      }),
    ).toThrow("registered surface has no discovered authority");
  });

  it("discovers convexPublic specs and direct UI hooks without treating publication registries as triggers", () => {
    const root = fixture({
      "packages/convex/confect/deploy/authority.spec.ts": `
        FunctionSpec.convexPublicMutation<typeof provision>()("provision");
        FunctionSpec.convexPublicQuery<typeof readiness>()("readiness");
      `,
      "apps/web/src/features/direct.tsx": `
        const mutate = useMutation(notes.create);
        const act = useAction(notes.publish);
      `,
      "packages/convex/confect/workflows/_generated/workflowRegistry.ts": `
        export const registry = definePublicationRegistry({
          capabilities: [publicationRelease],
          workflows: [workflowRelease],
        });
      `,
    });

    const discovered = discoverPublicAuthorities(root);
    expect(discovered).toEqual(
      expect.arrayContaining([
        {
          kind: "convex-function",
          registrationLocator: "deploy/authority:provision",
          transport: "api",
        },
        {
          kind: "convex-function",
          registrationLocator: "deploy/authority:readiness",
          transport: "api",
        },
        {
          kind: "ui-action",
          registrationLocator: "apps/web/src/features/direct.tsx",
          actionDiscriminant: "notes.create",
          transport: "ui",
        },
        {
          kind: "ui-action",
          registrationLocator: "apps/web/src/features/direct.tsx",
          actionDiscriminant: "notes.publish",
          transport: "ui",
        },
      ]),
    );
    expect(discovered.some(({ kind }) => kind === "trigger")).toBe(false);
  });

  it("resolves aliased UI hooks and route type aliases", () => {
    const root = fixture({
      "apps/web/src/routeTree.gen.ts": `
        type FileRoutesByFullPath = {
          '/aliased': unknown
        };
      `,
      "apps/web/src/features/aliased.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        const run = useSave;
        run(templateConfectRefs.notes.create);
      `,
    });

    expect(discoverPublicAuthorities(root)).toEqual(
      expect.arrayContaining([
        {
          kind: "route",
          registrationLocator: "apps/web/src/routeTree.gen.ts#/aliased",
          transport: "ui",
        },
        {
          kind: "ui-action",
          registrationLocator: "apps/web/src/features/aliased.tsx",
          actionDiscriminant: "templateConfectRefs.notes.create",
          transport: "ui",
        },
      ]),
    );
  });

  it("fails closed when a generated route tree or UI hook alias cannot be resolved", () => {
    const missingRouteDeclaration = fixture({
      "apps/web/src/routeTree.gen.ts": "export const routes = unknown;",
    });
    expect(() => discoverPublicAuthorities(missingRouteDeclaration)).toThrow(
      "FileRoutesByFullPath",
    );

    const unresolvedHookAlias = fixture({
      "apps/web/src/features/aliased.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        const run = condition ? useSave : undefined;
        run?.(templateConfectRefs.notes.create);
      `,
    });
    expect(() => discoverPublicAuthorities(unresolvedHookAlias)).toThrow(
      "could not be statically resolved",
    );
  });

  it("rejects an unresolved UI alias even when the same file has a resolvable call", () => {
    const root = fixture({
      "apps/web/src/features/mixed.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const run = condition ? useSave : undefined;
        run?.(templateConfectRefs.notes.update);
      `,
    });
    expect(() => discoverPublicAuthorities(root)).toThrow(
      "UI hook alias could not be statically resolved",
    );
  });

  it("rejects hook-bearing object properties and conditional callees", () => {
    const root = fixture({
      "apps/web/src/features/object-alias.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const hooks = { run: useSave };
        hooks.run?.(templateConfectRefs.notes.update);
        (condition ? useSave : fallback)(templateConfectRefs.notes.delete);
      `,
    });
    expect(() => discoverPublicAuthorities(root)).toThrow(
      "UI hook alias could not be statically resolved",
    );
  });

  it("rejects nested and bracketed hook-bearing object aliases", () => {
    const root = fixture({
      "apps/web/src/features/nested-object-alias.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const hooks = { nested: { run: useSave } };
        hooks.nested.run(templateConfectRefs.notes.update);
        hooks["nested"]["run"]?.(templateConfectRefs.notes.delete);
      `,
    });
    expect(() => discoverPublicAuthorities(root)).toThrow(
      "UI hook alias could not be statically resolved",
    );
  });

  it("rejects spread, conditional, and call-return hook aliases", () => {
    for (const body of [
      `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const hooks = { run: useSave };
        const spread = { ...hooks };
        spread.run(templateConfectRefs.notes.update);
      `,
      `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const selected = condition ? useSave : fallback;
        selected(templateConfectRefs.notes.delete);
      `,
      `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const makeHooks = () => ({ run: useSave });
        makeHooks().run(templateConfectRefs.notes.archive);
      `,
    ]) {
      const root = fixture({
        "apps/web/src/features/structural-aliases.tsx": body,
      });
      expect(() => discoverPublicAuthorities(root)).toThrow(
        "UI hook alias could not be statically resolved",
      );
    }
  });

  it("allows unrelated call-return member chains", () => {
    const root = fixture({
      "apps/web/src/features/structural-aliases.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        client().close();
        builder().execute();
      `,
    });
    expect(() => discoverPublicAuthorities(root)).not.toThrow();
  });

  it("rejects array and destructuring hook aliases", () => {
    for (const body of [
      `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const hooks = [useSave];
        hooks[0](templateConfectRefs.notes.update);
      `,
      `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const hooks = { run: useSave };
        const { run } = hooks;
        run(templateConfectRefs.notes.update);
      `,
    ]) {
      const root = fixture({
        "apps/web/src/features/structural-aliases.tsx": body,
      });
      expect(() => discoverPublicAuthorities(root)).toThrow(
        "UI hook alias could not be statically resolved",
      );
    }
  });

  it("allows ordinary non-hook arrays", () => {
    const root = fixture({
      "apps/web/src/features/structural-aliases.tsx": `
        import { useTemplateMutation as useSave } from '../adapters/confect-state';
        useSave(templateConfectRefs.notes.create);
        const values = [1, 2];
        values[0].toString();
        const labels = ["useSave"];
        labels[0].toString();
      `,
    });
    expect(() => discoverPublicAuthorities(root)).not.toThrow();
  });

  it("fetches the protected baseline Git object when a shallow checkout lacks it", () => {
    const calls: (readonly string[])[] = [];
    let showAttempts = 0;
    const digest = protectedLegacyBaselineDigest("/tmp/shallow", (args) => {
      calls.push(args);
      if (args[0] === "show" && showAttempts++ === 0)
        throw new Error("missing object");
      return Buffer.from(
        JSON.stringify({
          capturedFromInventoryDigest:
            "sha256:a5651112558862189a0782c9bad64a52e1a71795e532a7e62a41ad41a8de5b4e",
        }),
      );
    });
    expect(digest).toBe(
      "sha256:a5651112558862189a0782c9bad64a52e1a71795e532a7e62a41ad41a8de5b4e",
    );
    expect(calls[1]).toEqual([
      "fetch",
      "--no-tags",
      "--depth=1",
      "origin",
      "dd305838810a79583ce40c37ad2a86acf9238636",
    ]);
  });

  it("rejects duplicate discoveries, ids, and authority registrations", () => {
    const authority = {
      kind: "route" as const,
      registrationLocator: "apps/web/src/routeTree.gen.ts#/",
      transport: "ui" as const,
    };
    const surface = registered(authority, 0);

    expect(() =>
      generatePublicSurfaceInventory({
        discovered: [authority, authority],
        registered: [surface],
      }),
    ).toThrow("duplicate discovered public authority");
    expect(() =>
      generatePublicSurfaceInventory({
        discovered: [authority],
        registered: [surface, { ...surface, authPolicyId: "auth_other" }],
      }),
    ).toThrow("duplicate registered public authority");
    expect(() =>
      generatePublicSurfaceInventory({
        discovered: [authority],
        registered: [
          surface,
          {
            ...surface,
            authority: { ...surface.authority, registrationLocator: "other" },
          },
        ],
      }),
    ).toThrow("duplicate public surface id");
  });

  it("synthesizes a byte-stable one-time deny-all adoption baseline", () => {
    const discovered = [
      {
        kind: "route" as const,
        registrationLocator: "apps/web/src/routeTree.gen.ts#/settings",
        transport: "ui" as const,
      },
      {
        kind: "command" as const,
        registrationLocator: "verify",
        transport: "cli" as const,
      },
    ];
    const first = adoptLegacyPublicSurfaces(discovered);
    const second = adoptLegacyPublicSurfaces([...discovered].reverse());

    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authPolicyId: "auth_deny_all",
          coverageTag: expect.stringMatching(/^@covers_legacy_[a-f0-9]{24}$/u),
          id: expect.stringMatching(/^legacy_[a-f0-9]{24}$/u),
        }),
      ]),
    );
    const baseline = buildContractsLegacyBaseline(first);
    expect(baseline.capturedFromInventoryDigest).toMatch(
      /^sha256:[a-f0-9]{64}$/u,
    );
    expect(buildContractsLegacyBaseline(second)).toEqual(baseline);
    expect(verifyContractsLegacyBaseline(first, baseline)).toEqual([]);
  });

  it("never extends or rewrites an existing legacy baseline", () => {
    const original = registered(
      {
        kind: "route",
        registrationLocator: "apps/web/src/routeTree.gen.ts#/",
        transport: "ui",
      },
      0,
    );
    const baseline = buildContractsLegacyBaseline([original]);

    expect(
      verifyContractsLegacyBaseline(
        [
          original,
          registered(
            {
              kind: "route",
              registrationLocator: "apps/web/src/routeTree.gen.ts#/new",
              transport: "ui",
            },
            1,
          ),
        ],
        baseline,
      ),
    ).toContainEqual(expect.stringContaining("growth"));
    expect(
      verifyContractsLegacyBaseline(
        [{ ...original, authPolicyId: "auth_other" }],
        baseline,
      ),
    ).toContainEqual(expect.stringContaining("authority changed"));
    expect(
      verifyContractsLegacyBaseline(
        [{ ...original, coverageTag: "@covers_changed" }],
        baseline,
      ),
    ).toContainEqual(expect.stringContaining("inventory digest changed"));
  });

  it("rejects a candidate baseline even when its inventory digest is self-consistent", () => {
    const baseline = buildContractsLegacyBaseline([]);
    expect(
      verifyLegacyBaselineTrustAnchor(
        {
          ...baseline,
          capturedFromInventoryDigest:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toContainEqual(expect.stringContaining("trust anchor mismatch"));
  });

  it("reports a discovered locator omitted from the checked-in inventory", () => {
    const root = fixture({
      "apps/web/src/routeTree.gen.ts": `
        export interface FileRoutesByFullPath {
          '/missing': unknown
        }
      `,
      "packages/template-core/src/generated/public-surfaces.generated.json":
        JSON.stringify({ surfaces: [] }),
      "packages/template-core/src/generated/template-contracts-legacy-baseline.json":
        JSON.stringify(buildContractsLegacyBaseline([])),
    });

    const findings = checkGeneratedPublicSurfaceInventory(root);
    expect(findings).toContainEqual(
      expect.stringContaining("apps/web/src/routeTree.gen.ts#/missing"),
    );
    expect(findings).toContainEqual(
      expect.stringContaining("trust anchor mismatch"),
    );
  });
});
