# Implementation Brief Template

Use this brief when turning the template into a client-specific app. The
generator writes a concrete copy to
`docs/template/generated/implementation-brief.md`.

## Client Outcome

State the business result in plain language. For example: "Give the revenue team
a source-backed Brain that can answer GTM questions, compose a planning
workflow, and show why each recommendation is trusted."

## Selected Blueprint

Name the blueprint, why it fits, what must be renamed for the client, and what
must be deleted from demo data.

## Domain Nouns

List the nouns the client uses every day. Map each noun to an owner, source of
truth, retention expectation, and whether it belongs in template core, generated
extension code, or a private package.

## Source Inventory

Start with markdown, links, and notes. Add documents, CRM data, meetings, or
other integrations only when ownership, redaction, freshness, and retention are
clear.

## First Capability

Name the first capability, its typed args, returns, expected errors, policy
checks, provider adapters, and headless surfaces. Prefer one capability that
proves useful value end to end.

## First Workflow

Describe the workflow as a composition of capabilities: source selection,
context pack, capability call, approval, output, and Trust Receipt. Durable
graph data stays in the workflow schema, not in React Flow view state.

## First Agent

Define the agent as a nondeterministic actor with explicit grants. The agent may
call capabilities and start workflows; it should not call provider SDKs or raw
Convex functions directly.

## Provider Posture

Choose fake, test, or live-ready for WorkOS, PostHog, Dodo, provider-neutral
email, OpenRouter-compatible LLMs, storage, search, notifications, and
observability. Live setup requires typed config and adapter-specific
verification.

## Route Map

List web routes, API operations, CLI commands, MCP tools, and admin surfaces the
fork needs. Keep route modules thin and route data behind Confect refs or safe
loaders.

## Tests

Name focused behavior tests, contract checks, graph checks, provider seam tests,
and hosted smoke checks required before handoff.

## Deploy Path

Record local, staging, and production targets; Cloudflare Pages or Workers
decision; required env names; migration steps; and rollback.

## Handoff Risks

List missing secrets, unreviewed private package code, schema migration notes,
provider substitutions, data lifecycle obligations, and hosted smoke gaps.

## Handoff Criteria

Name the exact commands, hosted URL, status labels, and reviewer evidence needed
for handoff.
