# WP-5.1 Core Correction Integration Request

Do not integrate this leaf until the controller has accepted both CP-7 and CP-8.
This correction starts from `c9d8f12` and intentionally does not edit shared
composition, CLI, readiness, or gate files. It does not complete WP-5.1 or CP-9.

## Closed Input Manifest

`APP_MAP_INPUT_MANIFEST_V1` is the only accepted WP-5.1 core input inventory.
Root composition must name manifest ID `maestro-app-map-input` version `1` and
provide exactly one batch for every `requiredSources` entry. Adapter ID/version,
source ID/kind/path/subject/owner, digest contract, allowed fact kinds, and
ownership scope come from that manifest; composition must not infer them from a
filename or source text.

The `sha256-file-bytes-v1` contract hashes exact file bytes. The one
`sha256-canonical-tree-v1` source follows the sorted path/digest record contract
defined in `docs/template/app-map.md`; adapters must not substitute filesystem
walk order or a source-text-derived identity.

## Deferred G Schema And App Map Adapter Seam

G owns only the future canonical `template-instance.json` parser, schema
version, and support-range contract. G does not own an App Map adapter and does
not own provider or system topology. After G freezes that parser contract, A or
root may implement the exported `TemplateInstanceFactsAdapterV1` with this exact
interface:

```ts
type TemplateInstanceFactsAdapterV1 = {
  readonly adapterId: "template-instance-facts";
  readonly adapterVersion: 1;
  readonly sourceId: "template-instance";
  readonly load: (input: {
    readonly repoRoot: string;
  }) => Promise<AppMapFactBatchV1>;
};
```

The returned batch must meet all of these requirements:

1. `adapterId` is `template-instance-facts` and `adapterVersion` is `1`.
2. `source` is
   `{ id: "template-instance", kind: "template-instance", path: "template-instance.json", subject: "repository", owner: "template-instance-schema", digestContract: "sha256-file-bytes-v1", version, digest }`,
   exactly as reserved by `APP_MAP_INPUT_MANIFEST_V1`.
3. `version` is the canonical G-owned instance schema version rendered as a
   non-empty string.
4. `digest` is `sha256:` followed by the lower-case SHA-256 of the exact UTF-8
   bytes read from the target's canonical `template-instance.json`.
5. Under the current manifest entry the batch emits no nodes or edges. In
   particular, it does not emit provider/system nodes or `owns` edges. Any later
   fact scope requires a reviewed manifest-version change with adversarial
   tests.
6. The future adapter reads the G-owned parser/schema; it does not duplicate the
   template-instance type, accept a legacy fallback, scan source text, or infer
   missing facts.
7. Provider topology remains owned by the product-topology manifest authority,
   and system definitions remain owned by system-catalog. G schema fields do not
   transfer that ownership.
8. Missing, malformed, or unsupported instance data rejects `load`; it never
   returns cached or partially inferred facts.

Root composition supplies an exact repository revision, calls all 11 manifest
adapters, and passes their returned batches to `buildAppMap`. Adapter completion
order is irrelevant because the builder parses a closed representation and
canonicalizes ordering. The template-instance adapter remains deferred until G
freezes its parser/support-range seam.

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

After the G parser seam, A/root adapter, and mechanical registrations are each
reviewed and merged, run the App Map focused package checks, the double-build
`cmp`, `pnpm check:system-catalog`, `pnpm check:system-topology`,
`pnpm check:data-resources`, `pnpm check:workflow-semantics`, and
`pnpm check:headless-surface-contract`. Full `just verify` belongs to the
controller's accepted integration checkpoint, not this core correction. Passing
the leaf checks alone is not a WP-5.1 or CP-9 completion claim.
