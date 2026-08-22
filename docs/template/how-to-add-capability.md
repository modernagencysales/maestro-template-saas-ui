# How To Add A Capability

Dry-run a generated capability:

```bash
pnpm template:systems -- --query sources
pnpm template:add-capability -- --name summarizeSource --system knowledge-brain --disposition extend
```

Write the generated files:

```bash
pnpm template:add-capability -- --name summarizeSource --system knowledge-brain --disposition extend --description "Summarizes an approved source set." --exposure headless --write
```

Promote reviewed files into production-target Confect paths:

```bash
pnpm template:promote-capability -- --name summarizeSource --system knowledge-brain --disposition extend --description "Summarizes an approved source set." --write
```

## Files Created

The canonical system ID is validated before files are emitted and recorded in
headless metadata, generated docs, and generator provenance.

- Confect-oriented capability files under
  `packages/convex/confect/capabilities/<name>.spec.ts`,
  `packages/convex/confect/capabilities/<name>.impl.ts`,
  `packages/convex/confect/capabilities/<name>.domain.ts`,
  `packages/convex/confect/capabilities/<name>.test.ts`, and
  `packages/convex/confect/capabilities/<name>.headless.json`.
- Generated review docs under `docs/template/generated/capabilities/<name>.md`.
- Typed args and returns, with shared typed errors imported from
  `packages/convex/confect/errors.ts`.
- Capability headless metadata.
- Contract test scaffold.
- Follow-up docs for wiring the capability into the owning Confect group.

The generator writes flat Confect capability drafts that match existing files
such as `packages/convex/confect/capabilities/sourceGroundedBrief.spec.ts`.
After review, add the promoted group to the Confect spec tree, run
`pnpm confect:codegen`, run `pnpm confect:manifest`, then wire generated refs
into web/API/CLI/MCP surfaces only for explicitly exposed operations.

Future generator slices should add frontend adapters when user-facing and richer
fake fixtures once the capability owns provider side effects.

- Docs and audit metadata.

## Tests

- happy path;
- unauthenticated;
- role denial;
- cross-workspace denial;
- invalid input;
- typed error;
- idempotency;
- side-effect blocking before provider calls.

## Gates

- `pnpm confect:codegen`
- `pnpm confect:manifest`
- `pnpm --dir packages/convex test capabilities`
- `pnpm check:confect-contracts`
- `pnpm check:headless-surface-contract` when exposed.
