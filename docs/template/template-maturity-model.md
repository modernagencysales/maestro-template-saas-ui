# Template Maturity Model

Use these levels in investor notes, PR summaries, and client handoff packets.
They describe what the template can prove with current repo evidence.

Current baseline: this repo can prove L0 through L4 with current source,
generated artifacts, hosted smoke tests, app-factory commands, and CI gates.
That means it is a credible SaaS starter/factory baseline, not that every item
in the exhaustive porting backlog has shipped. L5 is client-fork-specific
because it requires live provider credentials, client-domain smoke, signed
handoff evidence, and production operations.

## L0 Hosted Shell

**Meaning:** the repo renders a hosted reference app with fake providers and a
typed architectural direction.

**Required evidence:** hosted URL, `apps/web/src/routes/index.tsx`,
`apps/web/src/saas-ui/business-shell.tsx`, visual smoke snapshots,
`docs/template/investor-reviewer-packet.md`.

**Required commands:** `pnpm check:format`, `pnpm smoke:web-static`,
`pnpm smoke:hosted:browser`, `pnpm smoke:hosted:a11y`,
`pnpm smoke:hosted:visual`.

**Investor inference:** the story is inspectable, but this level alone is not a
client implementation platform.

## L1 Honest Template

**Meaning:** docs clearly separate real code from fake, planned, and
live-provider seams.

**Required evidence:** `docs/template/porting-backlog.md`,
`docs/template/porting-roadmap.md`, `docs/template/security.md`,
`docs/template/reviewer-guide.md`, and this maturity model.

**Required commands:** `pnpm check:format`, `pnpm check:docs-freshness`,
`pnpm review:completion`.

**Investor inference:** the repo is diligence-ready because it does not
overclaim what has been wired.

## L2 Guarded Backend Slice

**Meaning:** tenancy, env/crypto/errors, provider gateway, policy/prompt, and
one source-grounded capability exist behind typed contracts.

**Required evidence:** `packages/convex/confect/access/*`,
`packages/convex/confect/shared/*`, `packages/integrations/src/*`,
`packages/convex/confect/policy/*`, and
`packages/convex/confect/capabilities/sourceGroundedBrief.*`.

**Required commands:** `pnpm confect:codegen`, `pnpm check:confect-contracts`,
`pnpm --dir packages/convex test`, `pnpm --dir packages/integrations test`,
`pnpm evals`.

**Investor inference:** the template can support a real custom AI Brain backend
without relying on untyped provider calls.

## L3 Workflow/Agent Slice

**Meaning:** one persisted workflow run and one bounded agent turn compose typed
capabilities with explicit tool grants.

**Required evidence:** `packages/convex/confect/workflows/*`,
`packages/convex/confect/agents/*`, workflow tests, agent tests, Trust Receipt
tests.

**Required commands:** `pnpm --dir packages/convex test workflow-run`,
`pnpm --dir packages/convex test trust-receipt`,
`pnpm --dir packages/convex test agent-runtime`.

**Investor inference:** the repo is more than a CRUD starter; it has the bones
of repeatable AI work execution.

## L4 Client-App Factory

**Meaning:** generators, frontend, CI, deploy tooling, docs, and handoff assets
support repeatable client forks. The frontend is a TanStack Start app with a
Saas UI business shell, typed data adapters, designed route states, and React
Flow constrained to workflow surfaces.

**Boundary:** L4 proves the template can start real client builds with strong
guardrails. [template-defaults.md](./template-defaults.md) is the default versus
extension-path decision record for surfaces such as billing, notification
center, retention jobs, and deploy promotion. It still leaves fork- or
product-specific work such as full tenant admin flows, every mutation toast, and
every future modal/popover adoption.

**Required evidence:** `tooling/generators/src/index.ts`,
`docs/template/quickstart.md`, `docs/template/generator-output-contract.md`,
`apps/web/src/router.tsx`, `packages/ui/src/*`, `.buildkite/*`, and
`project.config.json`.

**Required commands:** `pnpm check:generators`, `pnpm check:route-tree`,
`pnpm check:layer-boundaries`, `pnpm check:ci-completeness`,
`pnpm deploy:doctor`.

**Investor inference:** the template can accelerate bespoke B2B AI/GTM builds
instead of starting each one from a blank repo.

## L5 Production Client Fork

**Meaning:** a specific client fork has live provider credentials, deploy
promotion, retention/export/delete, observability, security controls, and a
signed handoff packet.

**Required evidence:** client `template-instance.json`, generated handoff
packet, live env manifest signoff, migration notes, deploy logs, provider setup
checklist, and client-specific security review.

**Required commands:** `pnpm template:doctor -- --mode live`,
`pnpm deploy:doctor`, `pnpm verify`, hosted smoke against the client domain, and
provider-specific sandbox or production smoke checks.

**Investor inference:** the factory has produced a production-ready client app.
