## Intention

<!-- ONE intention. If you can't say it in one sentence, split the PR. -->

## What changed

-

## Starter frontend authority

- Upstream source file or Pro block: `None` / exact path and pinned commit
- Deviation ledger entry: `None` / exact `docs/template/saas-ui-deviations.json`
  entry
- Desktop/mobile light/dark evidence: `None` / screenshot artifact paths
- Accessibility results: `None` / keyboard-only and 320 px evidence paths
- Pinned Starter/Pro source: `None` / exact path and commit
- Receipt impact: `None` / updated `saas-ui-starter-files.json` or
  `saas-ui-registry-files.json`
- Route-parity evidence: `None` / pasted `pnpm smoke:starter-route-parity`
  result

## Verification (paste evidence — do not assert)

```
# output of: pnpm verify (or the focused gate chain for this change)
```

## Checklist

- [ ] One intention; small, reviewable diff
- [ ] Scaffolded via `pnpm template:*` generators where one exists (no
      hand-rolled registrations)
- [ ] Checked `docs/template/system-catalog.json`; recorded `reuse`, `extend`,
      or a reviewed `introduce` decision and used canonical `--system` plus
      `--disposition` generator inputs
- [ ] Checked `docs/template/product-topology.json` for an existing production
      resource with this responsibility; no parallel capability/workflow/agent/
      job/route/headless/provider system was added
- [ ] Experiment/private-package work stays isolated; production promotion was
      re-scaffolded through `template:add-feature` or the matching generator
- [ ] Typed args AND returns; auth/workspace gate is the first statement in
      capability handlers
- [ ] Tests are behavioral (no source-text grep); co-located with the change
- [ ] No suppressions added (`eslint-disable` / `ts-expect-error`)
- [ ] Did NOT touch a gate file to make red turn green
- [ ] Generated frontend keeps the literal `_app` Starter route tree; no legacy
      `_workspace`, golden feature, business-shell, or custom navigation files
      are projected
- [ ] Docs updated when a subsystem changes status (real/fake/seam/planned)
- [ ] New/changed tables came from `template:add-table`, are present in
      `data-resources.json`, and declare tenancy, sensitivity, PII,
      export/delete/retention, write authority, and migration posture
- [ ] `check:system-catalog`, `check:system-topology`, `check:data-resources`,
      and `check:promotion-boundary` pass

> Draft first. Never self-merge. A green `pnpm verify` is the definition of
> ready for CI.
