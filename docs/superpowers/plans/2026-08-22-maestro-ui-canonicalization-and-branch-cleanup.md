# Maestro UI Canonicalization And Branch Cleanup Plan

- Status: started
- Factory authority: `modernagencysales/maestro-template-saas-ui` `main`
- Customer authority: a fresh customer repository generated from the next
  verified immutable template release
- Superseded UI authority: factory branch `product/maestro-brain`
- Superseded implementation candidate: PR 57 as a merge unit; retain only
  independently reviewed mechanical transplants

## Outcome

Maestro Brain runs from the complete pinned Saas UI/Starter shell and screens.
Product behavior is supplied through thin route, data, mutation, and auth
adapters. No generator, launcher, branch name, or text-level smoke can silently
replace that UI with hand-built screens.

The old branch population is reduced through reviewed recovery manifests. Every
deleted branch remains recoverable by one verified tag per unique commit.

## Non-Negotiable Rules

- Do not build Maestro Brain in the factory repository.
- Do not continue from `product/maestro-brain`.
- Do not merge PR 57 as-is.
- Do not generate the customer target from alpha.5.
- Do not hand-build an approximation when an assembled upstream screen exists.
- Do not accept the Saas UI diagnostic baseline as release type authority.
- Do not claim visual parity without paired upstream/generated evidence.
- Do not delete a branch from age, naming, or apparent duplication alone.

## Screen Authority

Use these compositions wholesale:

- The complete visible Saas UI Pro application shell, including navigation,
  responsive behavior, account/workspace controls, themes, and route layout.
- Starter Contacts for the Clients surface.
- Starter Inbox/SplitPage, its detail composition, and Editor for Brain.
- Settings plus IntegrationCard for Connections.
- The complete Settings route tree rather than a reduced custom settings page.
- UI Lab only in development; it is not customer navigation.

Allowed adaptations are import aliases, router bindings, typed data/mutation
adapters, and product labels/icons. Layout, component selection, interaction
structure, spacing, responsiveness, and upstream states remain unchanged.

## Work Packages

### WP-UI-01 — Dependency compatibility

- Classification: `template-gap`
- Target: one exact Chakra, Saas UI, Saas UI Pro, registry, and TipTap
  compatibility set
- Backlog: `MAESTRO-UI-CANON-01`
- Resolution: pin the tested matrix, deduplicate TipTap, rematerialize the
  registry, and remove the diagnostic-baseline gate from release authority
- Gates: frozen install, dependency-contract tests, real `tsc --noEmit` with
  zero diagnostics, focused web tests

### WP-UI-02 — Fake/review authentication

- Classification: `template-gap`
- Target: server request middleware and route-auth adapters
- Backlog: `MAESTRO-UI-CANON-02`
- Resolution: fake/review mode must not construct WorkOS middleware; live mode
  must fail closed when WorkOS configuration is absent
- Gates: middleware selection tests, fake production build/prerender, live
  missing-secret negative test, hosted fake and live route smoke

### WP-UI-03 — Screen provenance closure

- Classification: `template-gap`
- Target: screen catalog, Starter receipt, registry receipt, and foundation gate
- Backlog: `MAESTRO-UI-CANON-03`
- Resolution: catalog actual composition entry files and their complete import
  closure; record source hash, destination hash, and normalized allowed patches
- Gates: reconstruct pinned upstream source, reject unrecorded changes, reject
  unproven package-export substitution, validate generated-target receipts

### WP-UI-04 — UI-aware work packages and generators

- Classification: `template-gap`
- Target: `WorkPackageSchema`, executable recipes, and `template:add-feature`
- Backlog: `MAESTRO-UI-CANON-04`
- Resolution: add a typed `frontend` authority block containing screen catalog
  ID, source receipt, shell ID, allowed adaptations, and required visual states;
  fail closed when a frontend feature lacks a complete selected screen
- Gates: schema tests, recipe tests, generator preview tests, generated closure
  tests, and a negative test proving no hand-built JSX fallback exists

### WP-UI-05 — Complete shell and screens

- Classification: `template-gap` until WP-UI-04 supplies a reviewed generator;
  then execute as `pattern-instance`
- Target: Pro shell, Clients, Brain, Connections, and Settings route tree
- Backlog: `MAESTRO-UI-CANON-05`
- Resolution: mechanically transplant complete compositions and connect only
  thin typed adapters
- Gates: route-tree parity, provenance closure, zero TypeScript diagnostics,
  functional states, accessibility, and paired visual review

### WP-UI-06 — Visual evidence

- Classification: `template-gap`
- Target: real golden visual suites and immutable review artifacts
- Backlog: `MAESTRO-UI-CANON-06`
- Resolution: compare pinned upstream and generated screens on desktop/mobile,
  light/dark, and loading/empty/error/populated/selected/mutation states
- Gates: required scripts and suites exist, reviewed artifacts are nonempty,
  missing evidence fails release, and exact immutable receipt hashes pass

### WP-UI-07 — Customer identity and launcher cutover

- Classification: `template-gap`
- Target: generated Maestro Brain repository and launcher
- Backlog: `MAESTRO-UI-CANON-07`
- Resolution: bind launch to customer repository identity,
  `template-instance.json`, immutable release commit/checksum, screen receipts,
  and expected route tree; reject factory and factory product branches
- Gates: wrong-repository, wrong-release, wrong-route, stale-screen, and dirty
  target negatives plus the exact generated target hosted smoke

### WP-UI-08 — Branch archive and governance

- Classification: `template-gap`
- Target: remote branch population, GitHub ruleset, and recurring hygiene
- Backlog: `MAESTRO-UI-CANON-08`
- Resolution: use `pnpm branch:hygiene` for inventory; review stale unmerged
  branches for supersession; create one recovery tag per unique SHA; delete only
  exact approved names; add required checks and resolved-conversation rules
- Gates: before/after remote inventory, pushed-tag verification, open-PR and
  worktree census, reviewed cleanup receipt, ruleset API evidence

## Execution Order

1. Complete WP-UI-01. No screen transplant begins on an incompatible dependency
   graph or a typecheck baseline with nonzero diagnostics.
2. Complete WP-UI-02. Prove fake/review and live builds before adding deployment
   concerns to the UI work.
3. Complete WP-UI-03 and WP-UI-04. The factory must know and enforce what a
   complete screen is before it generates another customer target.
4. Execute WP-UI-05 as small mechanical screen slices. Do not mix behavior or
   Workers deployment into transplant commits.
5. Complete WP-UI-06 and seal a new immutable template release only after all
   runtime, provenance, type, and visual gates pass.
6. Generate a fresh Maestro Brain customer repository. Port backend behavior and
   adapters only; do not copy the old product branch filesystem.
7. Complete WP-UI-07 and prove the launcher rejects the factory and
   `product/maestro-brain` before cutting over.
8. Complete WP-UI-08 from a newly generated reviewed manifest. Archive the old
   Brain authority last, after the generated target is proven.

## PR Boundaries

- PR A: dependency compatibility and truthful zero-error typecheck
- PR B: fake/review authentication and build/prerender proof
- PR C: source reconstruction, composition closure, and provenance gates
- PR D: UI-aware work-package, recipe, and generator enforcement
- PR E: complete shell and screen transplants
- PR F: paired visual evidence and release sealing
- PR G: generated Maestro Brain target adapters and launcher cutover
- PR H: branch archive receipt, exact deletions, and GitHub ruleset

Workers deployment remains separate from UI transplantation. A deploy failure
must not encourage replacing the upstream shell, and a visually correct shell
must not conceal missing runtime configuration.

## Branch Cleanup State At Start

The first read-only manifest observed 63 remote branches:

- 24 classified `keep`.
- 39 stale unmerged branches classified `review-archive`.
- 0 branches classified `review-delete` without further review.
- 36 unique recovery tags cover the 39 stale candidates.
- Three stale candidate groups share duplicate commit heads.

These are inventory facts, not deletion approval. In particular,
`product/maestro-brain` stays available until the generated target, launcher
cutover, recovery tag, and explicit cleanup receipt are all proven.

## Release Definition Of Done

- Real TypeScript diagnostics are zero.
- Fake/review mode builds and runs without WorkOS secrets.
- Live mode fails closed without WorkOS and passes with reviewed configuration.
- Every customer screen has a pinned composition closure and allowed-patch
  receipt.
- Paired visual evidence exists for every required route and state.
- The customer target is a separate repository with valid immutable release
  identity.
- The launcher rejects factory branches and stale UI receipts.
- The old Brain branch is archived and removed only through the approved
  recovery manifest.
- `main` has enforced required checks and resolved review conversations.
