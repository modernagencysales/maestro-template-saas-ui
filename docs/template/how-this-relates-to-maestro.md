# How This Template Relates to Maestro

This document explains the relationship between two repositories so that anyone
picking up this template — a teammate, a client engineer, or a reviewer — can
understand where it came from, what is real, and what is intentionally left as a
seam to fill in.

## The two repos

- **`modernagencysales/maestro`** — the production application. It is a large
  (~340k LOC) multi-tenant AI product with real provider integrations (WorkOS
  AuthKit for auth, Dodo for billing, PostHog for analytics/telemetry,
  OpenRouter via the Vercel AI SDK for LLM calls), a real Convex backend, a
  durable workflow engine, an agent runtime with tool-calling, and a CI system
  that runs real static analysis, mutation testing, and AI review gates.

- **`modernagencysales/maestro-template`** (this repo) — an opinionated,
  deliberately small **starter shell** distilled from maestro. Its job is to let
  us stand up a bespoke "custom brain" application for a client quickly: bring a
  client's brain/knowledge sources, add their business logic, author and modify
  workflows and capabilities, wire the providers, and ship. It is the reusable
  skeleton, not the product. The current hosted reference app is a plain Saas UI
  business-app shell that explains the template in investor- and
  go-to-market-friendly language while keeping the reusable UI primitives in the
  repo.

Think of maestro as the reference implementation and this repo as the
opinionated subset we would want to start from on a new engagement.

## What was carried over (the skeleton is real)

The **architecture and vocabulary** are a genuine extraction from maestro, not
an invention:

- The layering
  `capabilities → workflows → agents → registry → headless surfaces (API/CLI/MCP/OpenAPI)`
  mirrors maestro's real structure
  (`packages/convex/convex/{capabilities,workflows,agents,registry}` and
  `adapters/{mcp,openapi,apiRoutes}.ts` in maestro).
- The provider **taxonomy** (auth / analytics / billing / email / LLM / storage
  / search) and its safety posture (required-env gating, payload redaction at
  boundaries, server-derived tenancy) reflect real maestro concerns.
- The multi-surface idea — the same capability reachable from web, CLI, MCP, and
  an OpenAPI-described HTTP API — is how maestro actually exposes work.

## What is deliberately different

- **Confect + Effect is a go-forward choice, not an extraction.** maestro today
  is built on plain Convex validators and does **not** use Confect or Effect.
  This template adopts Confect/Effect as the typed-contract default for _new_
  backend work (see `adr/0001-confect-effect-template-default.md`). This is an
  intentional bet to get stronger end-to-end type safety and tighter AI-agent
  coding constraints on everything we build from here forward. Do not read the
  Confect layer as "how maestro is built" — read it as "how we intend to build
  the next apps." The template also vendors `repos/effect/` and `repos/confect/`
  as read-only source references so coding agents can inspect real upstream
  patterns before writing typed backend code.

- **The template starts on fakes.** Providers default to fake/local mode so the
  shell runs with no client secrets. Real SDKs are installed and the adapters
  are meant to make real calls once env credentials are present — see
  `docs/template/porting-backlog.md` for the exact items still being brought
  over from maestro to make each seam real.

## What is a seam vs. what runs

Be honest with yourself and with reviewers about the current state:

| Area                                     | State in this template                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Architecture / layering / vocabulary     | Real, mirrors maestro                                                                             |
| Confect/Effect typed contracts           | Real, and the intended default going forward                                                      |
| Hosted reference app                     | Real Saas UI TanStack Start business shell                                                        |
| Code generators and app-factory commands | Real — they write checked scaffolds, demo seed data, and handoff artifacts                        |
| Provider adapters                        | Fake/test/live-ready seams; real SDK calls are enabled per client fork after env setup            |
| Workflow/agent execution                 | Real minimum slice exists; broader scheduling, replay, and advanced autonomy remain backlog items |
| Quality gates / CI                       | Real gate commands exist; client forks still need live-provider deploy proof                      |

The `porting-backlog.md` is the running list of what turns each seam into
something that actually runs, drawn item-by-item from maestro.

## How to repeat this extraction

If you are doing what produced this repo — distilling a big production app into
a reusable shell — the recipe is:

1. Keep the **layering and contracts**, drop the **business domain**. Port the
   registry/headless/adapter/workflow-engine _machinery_; leave client-specific
   capabilities (in maestro's case: LinkedIn harvest, lead magnets, campaigns)
   behind.
2. Replace live provider calls with **env-gated adapters** that default to fake,
   so the shell boots without secrets but goes live when keys are set — using
   the _same_ interface shape as the real integration, so filling the seam is a
   drop-in, not a rewrite.
3. Port the **quality gates that are generic** (registry/contract/tenancy
   invariants, coverage ratchet, dependency and dead-code checks) and wire the
   real off-the-shelf tools (knip, dependency-cruiser, type-coverage, Stryker)
   rather than shipping same-named placeholders.
4. Prove **one real vertical slice** end to end (a capability that makes a real
   model call, persists, and is covered by a non-trivial test and an eval) so
   the shell is demonstrably real at small scale, not just typed.
5. Write down, per subsystem, **what is real and what is a seam** — this file
   and the backlog are that record.
