## Intention

<!-- ONE intention. If you can't say it in one sentence, split the PR. -->

## What changed

-

## Verification (paste evidence — do not assert)

```
# output of: just verify (or the focused gate chain for this change)
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
- [ ] Docs updated when a subsystem changes status (real/fake/seam/planned)
- [ ] New/changed tables came from `template:add-table`, are present in
      `data-resources.json`, and declare tenancy, sensitivity, PII,
      export/delete/retention, write authority, and migration posture
- [ ] `check:system-catalog`, `check:system-topology`, `check:data-resources`,
      and `check:promotion-boundary` pass

> Draft first. Never self-merge. A green `just verify` is the definition of
> ready for CI.
