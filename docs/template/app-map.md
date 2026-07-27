# Maestro App Map

The Maestro App Map is a deterministic, read-only projection of canonical
template facts. It is not a mutable architecture database and does not create a
new source of authority.

## Work-Package Decision

- Work package: `WP-5.1`
- Classification: `template-gap`
- Backlog: `AP-010 architecture map and decision lifecycle`
- System disposition: `reuse`

The system-catalog query has no App Map system. That is intentional: the map
projects the existing canonical systems and registries. It adds no tables, write
authority, product lifecycle, background process, or parallel registry.

This corrected core leaf provides the schema, closed input manifest,
deterministic builder, validation, fixtures, and package-level checks. CLI,
Build Readiness, root-gate, concrete adapters, and template-instance composition
remain deferred integration work and must not be wired until the controller
accepts CP-7 and CP-8. This leaf is not a WP-5.1 or CP-9 completion claim.

## Contract

The V1 build input names `APP_MAP_INPUT_MANIFEST_V1` and contains an exact
subject revision plus exactly one fact batch for each of its 11 required source
authorities. Missing, duplicate, unknown, or inconsistent adapter/source
descriptors fail closed. A batch contains:

- the exact manifest adapter ID and version `1`;
- the manifest-bound source ID, kind, repository-relative path, subject, owner,
  digest contract, schema/version, and lower-case SHA-256 digest;
- versioned nodes;
- typed edges.

Every node and edge carries `authority: canonical`, the source identity and
path, the source version and digest observed when the fact was read, and a
stable fact ID. The validator compares that provenance with the current source
descriptor in the batch. A mismatch is stale; cached projections cannot satisfy
the check. All input, manifest-reference, subject, batch, source, node, edge,
and provenance objects use closed schemas; unknown fields are rejected. The
builder serializes only fresh normalized objects returned by that parser, never
caller-owned input objects.

`sha256-file-bytes-v1` hashes the exact source file bytes.
`sha256-canonical-tree-v1` rejects symlinks and special entries, sorts regular
files by canonical repository-relative path, renders each as
`<path>\0<lower-case file SHA-256>\n`, and hashes the exact UTF-8 record stream.
Both source digests use the `sha256:<64 lower-case hex>` representation.

V1 supports nodes for systems, resources, tables, routes, capabilities,
workflows and versions, semantic rules, agents, providers, packages, and
headless operations. Edge kinds are `owns`, `persists`, `invokes`, `projects`,
`exposes`, `depends-on`, `generated-by`, `governed-by`, and `verified-by`.

Canonical adapters may project only explicit machine-readable facts from:

- `docs/template/system-catalog.json`;
- `docs/template/product-topology.json`;
- `docs/template/data-resources.json`;
- generated Confect contract and JSON-schema manifests;
- generated workflow registries, graphs, semantic support contracts, and
  per-version coverage manifests;
- the generated route tree and headless operation registry;
- package/workspace dependency metadata;
- generator provenance;
- `template-instance.json` through `TemplateInstanceFactsAdapterV1`.

The current template-instance manifest entry reserves that future seam but
authorizes no node, edge, provider, system, or ownership facts. G owns the
future parser/schema contract only. A or root may implement the adapter after
that contract is frozen; provider and system topology remains with its explicit
manifest authorities.

Adapters do not scan arbitrary source text. If a registry does not expose a
fact, the adapter must return no fact and let validation report the ownership or
reference gap.

## Determinism And Human Projection

The builder sorts sources, nodes, edges, group membership, and every serialized
object key with a code-point comparator. It adds no time, host, process, or
filesystem-order field. JSON uses two-space indentation and one trailing
newline, so reordered adapter results produce identical bytes.

Edges also have a semantic relation identity independent of edge and provenance
IDs. V1 normalizes the typed `kind`, `from`, and `to` tuple (there is no modeled
discriminator yet) and rejects a duplicate tuple within one source or across
parallel authorities.

The human summary always groups nodes in this order:

1. Screens
2. Data
3. Automations
4. Connections

The package emits full JSON only after validation succeeds. The eventual CLI may
render the human summary by default and the exact JSON for `--json`; it must not
rebuild in a daemon or mutate canonical inputs.

## Closed Failures

| Code                         | Meaning                                                                             | Repair boundary                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `APP_MAP_INVALID_FACT`       | The inventory, manifest binding, closed shape, fact scope, or provenance is invalid | Repair the manifest-bound adapter and emit only the closed V1 contract |
| `APP_MAP_UNOWNED_NODE`       | A non-system node has no canonical system owner                                     | Add one reviewed ownership fact to its canonical registry              |
| `APP_MAP_DANGLING_EDGE`      | An endpoint is absent or has contested node authority                               | Register unique endpoints, then regenerate the edge                    |
| `APP_MAP_PARALLEL_AUTHORITY` | A source, fact, node, edge, semantic relation, or owner is defined more than once   | Retain one canonical authority and remove competing facts              |
| `APP_MAP_STALE_FACT`         | Fact provenance differs from the current source descriptor                          | Re-read that source through its V1 adapter                             |

Every diagnostic includes the canonical fact ID, a repair, and
`pnpm check:app-map` as its integration rerun command.

## Focused Leaf Checks

```bash
pnpm --dir tooling/app-map test
pnpm --dir tooling/app-map typecheck
pnpm --dir tooling/app-map lint
pnpm --dir tooling/app-map build:fixture > /tmp/app-map-a.json
pnpm --dir tooling/app-map build:fixture > /tmp/app-map-b.json
cmp /tmp/app-map-a.json /tmp/app-map-b.json
```

The generated projection is disposable. Removing the package or projection does
not modify its canonical registries or customer runtime state.
