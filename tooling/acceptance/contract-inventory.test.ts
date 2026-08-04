import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertNoAdmittedActivationOwnedSurfaces,
  compileContractInventory,
} from "./contract-inventory";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

const write = (root: string, path: string, value: string): void => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
};

const feature = (
  journey: string,
  lifecycle: string,
  scenarios: string,
): string => `@${journey} @${lifecycle}\nFeature: ${journey}\n${scenarios}`;

const scenario = (tags: string, name = "works"): string =>
  `  ${tags}\n  Scenario: ${name}\n    When it runs\n    Then it works\n`;

const surfaces = (entries: readonly Record<string, unknown>[]): string =>
  `${JSON.stringify({ surfaces: entries }, null, 2)}\n`;

const canonicalAuthPolicies = `
const policy = <T>(value: T): T => value;
const authPolicyEntries = Object.freeze({
  auth_deny_all: policy({ id: "auth_deny_all", credential: "deny-all", principalKind: "system", tenantAuthority: "none", requiredScopes: [] }),
  auth_public: policy({ id: "auth_public", credential: "public", principalKind: "anonymous", tenantAuthority: "none", requiredScopes: [] }),
  auth_owner_token: policy({ id: "auth_owner_token", credential: "owner-token", principalKind: "system", tenantAuthority: "none", requiredScopes: [] }),
  auth_build_pack_approve: policy({ id: "auth_build_pack_approve", credential: "session", principalKind: "user", tenantAuthority: "membership", minimumRole: "owner", requiredScopes: [] }),
  auth_session_membership_viewer: policy({ id: "auth_session_membership_viewer", credential: "session", principalKind: "user", tenantAuthority: "membership", minimumRole: "viewer", requiredScopes: [] }),
  auth_api_key_workspace_read: policy({ id: "auth_api_key_workspace_read", credential: "api-key", principalKind: "apiKey", tenantAuthority: "principal-workspace", requiredScopes: ["workspace:read"] }),
  auth_api_key_workspace_write: policy({ id: "auth_api_key_workspace_write", credential: "api-key", principalKind: "apiKey", tenantAuthority: "principal-workspace", requiredScopes: ["workspace:write"] }),
});
`;

const surface = (input: {
  id: string;
  transport: "ui" | "cli";
  journey?: `journey_${string}`;
  authPolicyId?: `auth_${string}`;
}) => ({
  id: input.id,
  transport: input.transport,
  coverageTag: `@covers_${input.id}`,
  ...(input.journey === undefined
    ? {}
    : { activationJourneyId: input.journey }),
  authPolicyId: input.authPolicyId ?? "auth_deny_all",
  authority: {
    kind: input.transport === "ui" ? "ui-action" : "command",
    registrationLocator: input.id,
  },
});

const fixture = (input: {
  candidate: Record<string, string>;
  base?: Record<string, string>;
  surfaceEntries?: readonly Record<string, unknown>[];
  baseSurfaceEntries?: readonly Record<string, unknown>[];
  candidateSurfaceEntries?: readonly Record<string, unknown>[];
}) => {
  const root = mkdtempSync(join(tmpdir(), "contract-inventory-"));
  roots.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "contract@example.test"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Contract Test"], { cwd: root });
  for (const [path, value] of Object.entries(input.base ?? {}))
    write(root, path, value);
  write(
    root,
    "packages/template-core/src/generated/public-surfaces.generated.json",
    surfaces(input.baseSurfaceEntries ?? input.surfaceEntries ?? []),
  );
  write(
    root,
    "packages/convex/confect/capabilities/_kit/authPolicies.ts",
    canonicalAuthPolicies,
  );
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "commit", "-qm", "base"],
    {
      cwd: root,
    },
  );
  const protectedBaseSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  rmSync(join(root, "features"), { recursive: true, force: true });
  write(
    root,
    "packages/template-core/src/generated/public-surfaces.generated.json",
    surfaces(
      input.candidateSurfaceEntries ??
        input.surfaceEntries ??
        input.baseSurfaceEntries ??
        [],
    ),
  );
  write(
    root,
    "packages/convex/confect/capabilities/_kit/authPolicies.ts",
    canonicalAuthPolicies,
  );
  for (const [path, value] of Object.entries(input.candidate))
    write(root, path, value);
  return { root, protectedBaseSha };
};

describe("compileContractInventory", () => {
  it("resolves admitted coverage and generates a sorted authoritative inventory", () => {
    const ui = surface({
      id: "orders_ui",
      transport: "ui",
      journey: "journey_orders",
    });
    const cli = surface({
      id: "orders_cli",
      transport: "cli",
      journey: "journey_orders",
    });
    const admitted = feature(
      "journey_orders",
      "admitted",
      [
        scenario("@ui @covers_orders_ui", "UI positive"),
        scenario("@ui @authentication @covers_orders_ui", "UI authn"),
        scenario("@ui @authorization @covers_orders_ui", "UI authz"),
        scenario("@ui @tenant-isolation @covers_orders_ui", "UI tenant"),
        scenario("@cli @covers_orders_cli", "CLI positive"),
        scenario("@cli @authentication @covers_orders_cli", "CLI authn"),
        scenario("@cli @authorization @covers_orders_cli", "CLI authz"),
        scenario("@cli @tenant-isolation @covers_orders_cli", "CLI tenant"),
        scenario(
          "@ui @cli @cross-surface @covers_orders_ui @covers_orders_cli",
          "same record",
        ),
      ].join(""),
    );
    const assembling = feature(
      "journey_draft",
      "assembling",
      scenario("@ui @covers_future_ui"),
    );
    const repo = fixture({
      base: { "features/orders.feature": admitted },
      candidate: {
        "features/orders.feature": admitted,
        "features/draft.feature": assembling,
      },
      surfaceEntries: [ui, cli],
    });

    const inventory = compileContractInventory({
      ...repo,
      mode: "authoritative",
    });

    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.journeys).toEqual({
      journey_draft: "assembling",
      journey_orders: "admitted",
    });
    expect(inventory.admittedPickleKeys).toEqual(
      inventory.pickles
        .filter((pickle) => pickle.lifecycle === "admitted")
        .map((pickle) => pickle.key),
    );
    expect(inventory.sources.map((source) => source.uri)).toEqual([
      "features/draft.feature",
      "features/orders.feature",
    ]);
  });

  it("allows unresolved assembling intents but rejects them at admission", () => {
    const assembling = fixture({
      candidate: {
        "features/draft.feature": feature(
          "journey_draft",
          "assembling",
          scenario("@ui @covers_future"),
        ),
      },
    });
    expect(() =>
      compileContractInventory({ ...assembling, mode: "static" }),
    ).not.toThrow();

    const admitted = fixture({
      candidate: {
        "features/draft.feature": feature(
          "journey_draft",
          "admitted",
          scenario("@ui @covers_future"),
        ),
      },
    });
    expect(() =>
      compileContractInventory({ ...admitted, mode: "static" }),
    ).toThrow(/unresolved coverage/u);
  });

  it.each([
    ["absent -> admitted", undefined, "admitted"],
    ["admitted -> assembling", "admitted", "assembling"],
    ["admitted -> deleted", "admitted", undefined],
    ["suspended -> deleted", "suspended", undefined],
  ])("rejects %s", (_name, baseLifecycle, candidateLifecycle) => {
    const base =
      baseLifecycle === undefined
        ? {}
        : {
            "features/x.feature": feature(
              "journey_x",
              baseLifecycle,
              scenario("@ui @covers_x"),
            ),
          };
    const candidate =
      candidateLifecycle === undefined
        ? {}
        : {
            "features/x.feature": feature(
              "journey_x",
              candidateLifecycle,
              scenario("@ui @covers_x"),
            ),
          };
    const repo = fixture({ base, candidate });
    expect(() =>
      compileContractInventory({ ...repo, mode: "authoritative" }),
    ).toThrow(/lifecycle|deleted|absent/u);
  });

  it("rejects duplicate journeys and normalized path collisions", () => {
    const value = feature("journey_x", "assembling", scenario("@ui"));
    const repo = fixture({
      candidate: {
        "features/a.feature": value,
        "features/b.feature": value,
      },
    });
    expect(() => compileContractInventory({ ...repo, mode: "static" })).toThrow(
      /collision|duplicate journey/u,
    );
  });

  it("requires cross-surface proof only for exhaustive multi-transport owners", () => {
    const single = surface({
      id: "single_ui",
      transport: "ui",
      journey: "journey_single",
    });
    const singleRepo = fixture({
      candidate: {
        "features/single.feature": feature(
          "journey_single",
          "admitted",
          [
            scenario("@ui @covers_single_ui", "positive"),
            scenario("@ui @authentication @covers_single_ui", "authn"),
          ].join(""),
        ),
      },
      surfaceEntries: [single],
    });
    expect(() =>
      compileContractInventory({ ...singleRepo, mode: "static" }),
    ).not.toThrow();

    const multiRepo = fixture({
      candidate:
        singleRepo.root === ""
          ? {}
          : {
              "features/single.feature": feature(
                "journey_single",
                "admitted",
                [
                  scenario("@ui @covers_single_ui", "positive"),
                  scenario("@ui @authentication @covers_single_ui", "authn"),
                  scenario("@cli @covers_single_cli", "CLI positive"),
                  scenario(
                    "@cli @authentication @covers_single_cli",
                    "CLI authn",
                  ),
                ].join(""),
              ),
            },
      surfaceEntries: [
        single,
        surface({
          id: "single_cli",
          transport: "cli",
          journey: "journey_single",
        }),
      ],
    });
    expect(() =>
      compileContractInventory({ ...multiRepo, mode: "static" }),
    ).toThrow(/cross-surface/u);
  });

  it.each([
    ["public credential", "auth_public", "weaker"],
    ["removed tenant authority", "auth_owner_token", "incomparable"],
    ["lowered role", "auth_session_membership_viewer", "weaker"],
    ["removed scope", "auth_api_key_workspace_read", "incomparable"],
  ] as const)(
    "reports %s for controller-owned approval",
    (_name, candidatePolicyId, comparison) => {
      const journey = feature(
        "journey_policy",
        "assembling",
        scenario("@ui @covers_policy_ui"),
      );
      const basePolicyId = candidatePolicyId.startsWith("auth_session")
        ? "auth_build_pack_approve"
        : "auth_api_key_workspace_write";
      const repo = fixture({
        base: { "features/policy.feature": journey },
        candidate: { "features/policy.feature": journey },
        baseSurfaceEntries: [
          surface({
            id: "policy_ui",
            transport: "ui",
            journey: "journey_policy",
            authPolicyId: basePolicyId,
          }),
        ],
        candidateSurfaceEntries: [
          surface({
            id: "policy_ui",
            transport: "ui",
            journey: "journey_policy",
            authPolicyId: candidatePolicyId,
          }),
        ],
      });

      expect(
        compileContractInventory({ ...repo, mode: "authoritative" })
          .authPolicyDeltas,
      ).toEqual([
        {
          surfaceId: "policy_ui",
          basePolicyId,
          candidatePolicyId,
          comparison,
        },
      ]);
    },
  );

  it("detects policy weakening under an unchanged policy ID from protected source", () => {
    const source = feature(
      "journey_policy_source",
      "assembling",
      scenario("@ui @covers_policy_source_ui"),
    );
    const policySource = (scopes: string): string => `
      const policy = <T>(value: T): T => value;
      const authPolicyEntries = Object.freeze({
        auth_api_key_workspace_write: policy({
          id: "auth_api_key_workspace_write",
          credential: "api-key",
          principalKind: "apiKey",
          tenantAuthority: "principal-workspace",
          requiredScopes: [${scopes}],
        }),
      });
    `;
    const repo = fixture({
      base: {
        "features/policy.feature": source,
        "packages/convex/confect/capabilities/_kit/authPolicies.ts":
          policySource('"workspace:write"'),
      },
      candidate: {
        "features/policy.feature": source,
        "packages/convex/confect/capabilities/_kit/authPolicies.ts":
          policySource(""),
      },
      baseSurfaceEntries: [
        surface({
          id: "policy_source_ui",
          transport: "ui",
          journey: "journey_policy_source",
          authPolicyId: "auth_api_key_workspace_write",
        }),
      ],
      candidateSurfaceEntries: [
        surface({
          id: "policy_source_ui",
          transport: "ui",
          journey: "journey_policy_source",
          authPolicyId: "auth_api_key_workspace_write",
        }),
      ],
    });
    expect(
      compileContractInventory({ ...repo, mode: "authoritative" })
        .authPolicyDeltas,
    ).toEqual([
      {
        surfaceId: "policy_source_ui",
        basePolicyId: "auth_api_key_workspace_write",
        candidatePolicyId: "auth_api_key_workspace_write",
        comparison: "weaker",
      },
    ]);
  });

  it("allows surface retirement only from a suspended tombstone and preserves its prose", () => {
    const tombstone = feature(
      "journey_retired",
      "suspended",
      scenario("@ui @covers_retired_ui", "Retired behavior"),
    );
    const retired = fixture({
      base: { "features/retired.feature": tombstone },
      candidate: { "features/retired.feature": tombstone },
      baseSurfaceEntries: [
        surface({
          id: "retired_ui",
          transport: "ui",
          journey: "journey_retired",
        }),
      ],
      candidateSurfaceEntries: [],
    });
    expect(() =>
      compileContractInventory({ ...retired, mode: "authoritative" }),
    ).not.toThrow();

    const rewritten = fixture({
      base: { "features/retired.feature": tombstone },
      candidate: {
        "features/retired.feature": tombstone.replace(
          "Then it works",
          "Then history was rewritten",
        ),
      },
    });
    expect(() =>
      compileContractInventory({ ...rewritten, mode: "authoritative" }),
    ).toThrow(/retain its behavioral prose/u);
  });

  it("rejects an admitted journey with zero activation-owned surfaces", () => {
    const repo = fixture({
      candidate: {
        "features/orphan.feature": feature(
          "journey_orphan",
          "admitted",
          scenario("@ui @covers_shared_ui"),
        ),
      },
      candidateSurfaceEntries: [surface({ id: "shared_ui", transport: "ui" })],
    });
    expect(() => compileContractInventory({ ...repo, mode: "static" })).toThrow(
      /zero|without an activation-owned/u,
    );
  });

  it("proves no-admitted projections keep activation-owned registrations dark", () => {
    const surfaces = [
      surface({ id: "draft_ui", transport: "ui", journey: "journey_draft" }),
      surface({ id: "shared_ui", transport: "ui" }),
    ];
    expect(() =>
      assertNoAdmittedActivationOwnedSurfaces(
        { journey_draft: "assembling" },
        surfaces,
      ),
    ).not.toThrow();
    expect(() =>
      assertNoAdmittedActivationOwnedSurfaces(
        { journey_draft: "admitted" },
        surfaces,
      ),
    ).toThrow(/activation-owned surface/u);
  });
});
