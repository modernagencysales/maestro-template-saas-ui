# Delivery Story

Why this repo exists, how it was built, and how to read its history.

## Why

Maestro Template is the reusable extraction of
[maestro](https://github.com/modernagencysales/maestro), Modern Agency Sales'
production AI/GTM platform. Every client engagement used to re-decide the same
platform questions — tenancy, typed backend contracts, workflow durability,
provider adapters, release discipline. The template freezes those decisions into
a working starting point so an engagement begins at the business logic, not at
the plumbing.

## How it was built

The template was delivered by AI coding agents (Claude) operating under the same
gate discipline the repo enforces on any contributor — that is the methodology
being demonstrated, not a shortcut around it:

- Every change passed the full local verify chain (format, lint with the
  layer-law ESLint pack, typecheck, ~550 tests, coverage ratchet, dependency and
  secret scanning, docs pins) before it was pushed.
- Every pull request runs the Woodpecker verification pipeline: a secretless
  self-protection step that refuses PRs which weaken CI and the deterministic
  gate suite. Taste and contract review run through the bounded PR firewall and
  fail closed; guarded staging and production deployments use separate
  Woodpecker events.
- The machinery itself was ported from maestro's production CI, then proven by
  iterating on live builds until the whole pipeline was green end to end —
  including failures that only a bare CI agent could surface.

## How to read the history

- Commits carry `Co-Authored-By: Claude` trailers. That is provenance, not
  boilerplate: it marks which changes were agent-delivered under the gates.
- The history is honest about failures. CI hardening landed as a sequence of red
  builds each fixing the previous failure (bare agents, corepack key rotation,
  tree-walking gates, cross-platform coverage variance). Those commits document
  what running the gates for real actually costs. For fast verification, use the
  commit ranges and CI anchors in
  [`delivery-receipts.md`](./delivery-receipts.md).
- Human decisions are recorded where they happened: design calls (keep vendored
  `repos/`, fixture-backed ops domains, thin live surface) live in README design
  decisions and AGENTS.md, and were made by the maintainer, not inferred by the
  agent.

## What this means for a reviewer

The claim this repo makes is narrow and checkable: an AI-heavy delivery process
can produce production-shaped software when every change is forced through
mechanical and adversarial review gates. The evidence is the gate configuration
(all real, all wired — see `docs/rule-coverage.md`), the CI history with
receipts in [`delivery-receipts.md`](./delivery-receipts.md), and the hosted app
streaming live data from the deployed backend.
