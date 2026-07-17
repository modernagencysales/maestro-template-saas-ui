# Whole-Program Acceptance Reconciliation

Integration evidence stays immutable. In particular, reconciliation never
changes a lane result, integration result, archive artifact, or archive manifest
to turn `integrated` into `accepted`.

After an exact product head contains the required acceptance prerequisites, run
`brain-reconcile-acceptance` with absolute `workdir` and `evidence_dir` inputs
plus that exact 40-character `head_sha`. The workflow:

1. requires a clean worktree at the supplied head;
2. runs `rtk host-test-slot --class full pnpm verify` and records the standard
   exact-head broad-gate receipt;
3. validates each candidate task against its current lane identity and the
   write-once content-addressed integration archive;
4. expands the original `acceptanceAfter` expression from the checked task
   manifest and computes the complete prerequisite closure; and
5. writes one replay-safe receipt at
   `evidence/acceptance/receipts/<sha256>.json`.

The receipt binds the product-release commit, plan hash, full-gate receipt hash,
sorted accepted tasks, expanded prerequisite IDs, integration heads, and archive
hashes. A missing prerequisite, missing archive, non-ancestor integration head,
red or stale broad gate, review finding, or archive drift fails closed. External
and release tasks are not inferred from product integration evidence: an
external task must already have explicit `status: accepted` evidence, and
release approval remains owned by `brain-release-evidence`.

For a previously recorded exact-head full gate, the deterministic command is:

```bash
rtk pnpm brain:factory:reconcile-acceptance -- \
  --workdir /absolute/frozen-worktree \
  --evidence /absolute/evidence-directory \
  --broad-gate /absolute/evidence-directory/integration/acceptance-program/broad-gate-<HEAD>.json
```

Replaying the command produces the same content hash. A later product head gets
a new receipt; old receipts and all integration archives remain untouched.
