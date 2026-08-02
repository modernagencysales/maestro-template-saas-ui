# Isolated Publication Tagged Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the historical isolated workflow publication fixture from its
exact pinned Git tag while preserving ordinary worktree drift detection.

**Architecture:** Add a strict Git-object reader beside the publication-stack
builder. The builder uses it only for tagged descriptors that are both published
and isolated; all ordinary callers retain `findPublishedClosureDrift` and
current worktree semantics. Tagged metadata and closure bytes are recomputed
without rewriting publication files.

**Tech Stack:** TypeScript, Node.js `child_process`/`crypto`, Vitest, Git object
plumbing, pnpm 10.12.1, Node 22.23.2.

## Global Constraints

- Pin `maestro-template-v0.2.0-alpha.1` to tag object
  `d7fefbdcf2c30fb5c9e7b7d6c5b83c31c93e55f8` and commit
  `35c5bd1b1b011320f5790eca7bd1356174b20fc9`.
- Fail closed with no worktree or regeneration fallback when tagged authority
  cannot be proven.
- Do not rewrite a manifest, descriptor, authority, release module, checksum, or
  tag.
- Do not classify authored Confect source as generated or mutable.
- Do not run connected codegen, broad tests, publish, seal, deploy, Fabro, or
  switch a public default.
- Run tests through a focused host-test slot with Node `22.23.2` and
  `/private/tmp/maestro-pnpm-10-bin/pnpm`.

---

### Task 1: Pin And Validate The Isolated Publication Tag

**Files:**

- Modify: `tooling/generators/src/workflow-publication-generation.ts`
- Test: `tooling/generators/src/workflow-publication-generation.test.ts`

**Interfaces:**

- Consumes: tagged `ReleaseDescriptor` and publication-manifest entries.
- Produces: `findPinnedIsolatedPublicationDrift(cwd, inputs, authority?)`, which
  returns current immutable-metadata drift only after exact tagged closure
  validation succeeds.

- [ ] **Step 1: Write failing regressions**

Add tests that require current authored closure evolution to remain clean for
the isolated fixture, require immutable metadata mutation to remain drift,
require ordinary `findPublishedClosureDrift` behavior to remain unchanged, and
require missing/moved tag plus tagged checksum mismatch to throw.

- [ ] **Step 2: Verify the focused suite is red**

Run:

```bash
rtk host-test-slot --class focused fnm exec --using=22.23.2 /private/tmp/maestro-pnpm-10-bin/pnpm --dir tooling/generators exec vitest run src/workflow-publication-generation.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: the existing three 41-path failures remain and new tagged-authority
expectations fail because the strict reader does not exist.

- [ ] **Step 3: Implement the strict reader**

Resolve `refs/tags/maestro-template-v0.2.0-alpha.1`, require the exact annotated
tag object and peeled commit, read blobs with `git cat-file blob`, parse the
tagged descriptors/manifest, require `published` plus `isolatedFixture: true`,
and recompute every tagged closure/artifact checksum. Compare only the immutable
publication metadata paths with current worktree bytes. Throw on every authority
failure and provide no fallback.

- [ ] **Step 4: Verify the focused suite is green**

Run the exact command from Step 2. Expected: one file passes with all tests and
zero failures.

- [ ] **Step 5: Verify the directly affected boundaries**

Run:

```bash
rtk host-test-slot --class focused fnm exec --using=22.23.2 /private/tmp/maestro-pnpm-10-bin/pnpm --dir tooling/generators typecheck
rtk host-test-slot --class focused fnm exec --using=22.23.2 /private/tmp/maestro-pnpm-10-bin/pnpm exec vitest run tooling/quality/check-workflow-version-immutability.test.mts --maxWorkers=1 --no-file-parallelism
```

Expected: both commands exit zero.

- [ ] **Step 6: Commit the bounded slice**

```bash
rtk git add docs/superpowers/specs/2026-08-02-isolated-publication-tag-authority-design.md docs/superpowers/plans/2026-08-02-isolated-publication-tag-authority.md tooling/generators/src/workflow-publication-generation.ts tooling/generators/src/workflow-publication-generation.test.ts
rtk git commit -m "fix: pin isolated publication authority"
```
