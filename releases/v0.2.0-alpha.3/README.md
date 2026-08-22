# Maestro Template v0.2.0-alpha.3

External-tester release for the SaaS application factory.

## What changed

- `maestro create` is bound to this immutable release and prints the complete
  Git, install, baseline, preflight, and fake-start sequence.
- Generated customer targets expose `maestro recipes` and transactional
  `maestro add` commands.
- Customer preflight trusts packaged release facts without requiring factory
  tags or source commits in the customer's new Git repository.
- The starter record slice now carries canonical system ownership, product
  topology, data lifecycle metadata, and the generated lifecycle runtime.
- The starter Confect record spec and implementation are flat so generated
  public refs remain `public.records.*`.
- Human and agent onboarding now share one preview, review, write, verify, run
  method.

## Compatibility and environment

- Node 22 and the checked-in pnpm lockfile are required.
- No new environment variables or live provider credentials are required for
  fake mode.
- Existing alpha.1 targets require a reviewed file upgrade; random file copying
  from the factory is unsupported.

## Generated contract diff

- Added customer CLI recipe handlers and recipe transaction runtime.
- Added `record-management`, the `records` data resource, `/records` topology,
  and their system/schema decisions.
- Moved record Confect source from `confect/records/records.{spec,impl}.ts` to
  `confect/records.{spec,impl}.ts`; regenerated refs and wrappers are required.

## Migration and rollback

No data migration is required. See
[migrations/README.md](./migrations/README.md) for the file transition. Roll
back with the pre-upgrade Git commit; customer data is unchanged.
