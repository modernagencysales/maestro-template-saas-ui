# WP-5.1 Integration Request

Do not integrate this leaf until the controller has accepted both CP-7 and CP-8.
The leaf is based on `e9c9123` and intentionally does not edit shared
composition or gate files.

## G/Root Adapter Contract

G or root must implement the exported `TemplateInstanceFactsAdapterV1` without
changing this interface:

```ts
type TemplateInstanceFactsAdapterV1 = {
  readonly adapterVersion: 1;
  readonly sourceId: "template-instance";
  readonly load: (input: {
    readonly repoRoot: string;
  }) => Promise<AppMapFactBatchV1>;
};
```

The returned batch must meet all of these requirements:

1. `adapterVersion` is `1`.
2. `source` is
   `{ id: "template-instance", kind: "template-instance", path: "template-instance.json", version, digest }`.
3. `version` is the canonical G-owned instance schema version rendered as a
   non-empty string.
4. `digest` is `sha256:` followed by the lower-case SHA-256 of the exact UTF-8
   bytes read from the target's canonical `template-instance.json`.
5. Every emitted node and edge copies that source path, version, and digest into
   its provenance and uses a stable canonical-field fact ID.
6. The adapter reads the G-owned parser/schema; it does not duplicate the
   template-instance type, accept a legacy fallback, scan source text, or infer
   missing facts.
7. It emits an ownership edge only when the canonical template-instance schema
   declares that system owner. Otherwise the system/topology adapter must emit
   the edge, and validation must fail closed until one canonical owner exists.
8. Missing, malformed, or unsupported instance data rejects `load`; it never
   returns cached or partially inferred facts.

Root composition supplies an exact repository revision and calls all V1
adapters, then passes their returned batches directly to `buildAppMap`. Adapter
completion order is irrelevant because the builder canonicalizes ordering.

## Mechanical Registrations After CP Acceptance

Perform these registrations in one controller-owned integration slice:

1. Lockfile/workspace:
   - Run `pnpm install --lockfile-only` so `tooling/app-map/package.json` gets a
     workspace importer in `pnpm-lock.yaml`.
   - Add `"@maestro-template/app-map-tooling": "workspace:*"` to
     `apps/cli/package.json` when CLI composition imports the package.
2. Root scripts in `package.json`:
   - `"test:app-map": "pnpm --dir tooling/app-map test"`
   - `"check:app-map": "pnpm --dir tooling/app-map check"`
   - append `pnpm check:app-map` to `verify` beside the other deterministic
     topology checks;
   - append `pnpm --dir tooling/app-map test` to `test:tooling`.
3. Just recipes in `Justfile`:
   - `test-app-map: pnpm test:app-map`
   - `check-app-map: pnpm check:app-map`
4. CLI composition:
   - add the read-only handler in `apps/cli/src/factory/map.ts`;
   - register it once in the `handlers` array in
     `apps/cli/src/factory/composition.ts`;
   - render `renderAppMapSummary` by default and `result.json` only for
     `pnpm maestro -- map --json`;
   - return nonzero with the package diagnostics when `buildAppMap` is not OK;
   - add handler/router tests, but do not add MCP, mutation, or background
     rebuild behavior.
5. Build Readiness projection:
   - adapt a successful map into the existing `screens`, `data`, `automations`,
     and `connections` summary in
     `tooling/agent-pack/src/readiness/presenter.ts`;
   - keep full nodes and affected systems under technical details;
   - compose the adapter in `apps/cli/src/factory/composition.ts`; do not make
     the Agent Pack read App Map source files directly.
6. Gate registry:
   - add an `app-map` static descriptor named `check:app-map` to
     `tooling/quality/src/check-definitions.mts`, with canonical doc
     `docs/template/app-map.md` and focused paths `tooling/app-map` plus the
     canonical adapter leaves;
   - add `app-map` to the required static sequence asserted by
     `tooling/quality/src/diagnosticRegistry.test.mts`;
   - pin `pnpm check:app-map` in the existing CI-completeness/config-drift
     inventories and root verify contract.

Do not add a hook, daemon, graph database, embeddings, source-text inference,
network call, Graphify dependency, release artifact, or alternate canonical
registry as part of integration.

## Controller Verification

After merging G's adapter and the mechanical registrations, run the WP-5.1
focused package checks, the double-build `cmp`, `pnpm check:system-catalog`,
`pnpm check:system-topology`, `pnpm check:data-resources`,
`pnpm check:workflow-semantics`, and `pnpm check:headless-surface-contract`.
Full `just verify` belongs to the controller's accepted integration checkpoint,
not this speculative leaf.
