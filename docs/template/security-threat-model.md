# Template Security Threat Model

This threat model names the default risks for B2B AI Brain, workflow, and agent
applications built from this template. Each mitigation should be verified in the
client fork before moving from fake/test mode to live mode.

| Threat                                  | Mitigation                                                                                                                                      | Backlog / evidence                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Cross-tenant data access                | Resolve workspace and organization roles on the server, deny archived or suspended tenants, and never trust caller-supplied role state.         | Backlog A/R; `packages/convex/confect/access/*`    |
| Caller-supplied workspace identity      | Route all user actions through workspace membership checks and inject verified scope into handlers.                                             | Backlog A6-A8/R237; `access/auth.ts`               |
| Forged or stale workflow authority      | Construct V2 principals server-side, pin policy versions, narrow child grants, and reauthorize current membership before consequential effects. | WP-1.9; `workflows/_kit/principal.ts`              |
| Prompt injection through source content | Treat source content as data, wrap untrusted text, pin prompts/policies, and require evidence-backed outputs.                                   | Backlog D/P; `policy/prompts/xmlUserPrompt.ts`     |
| Webhook replay and signature confusion  | Verify signatures before parsing provider semantics, dedupe event IDs, and keep redacted public errors.                                         | Backlog C28/H; `packages/integrations/src/dodo.ts` |
| Provider payload leakage                | Redact provider payloads at adapter boundaries and expose closed public error envelopes.                                                        | Backlog C/G; `headless/errorEnvelope.ts`           |
| Public review-token leakage             | Store only hashes for bearer-like tokens, use bounded signed tokens, and support revocation.                                                    | Backlog B/G/Q                                      |
| Support/admin overreach                 | Require explicit admin role checks, audit admin mutations, and keep support access time-bound.                                                  | Backlog R/S; `docs/template/support-admin.md`      |
| Spend abuse and runaway model calls     | Use LLM kill switch, conservative spend estimates, per-workspace caps, rate limits, and fake mode by default.                                   | Backlog C/H; `packages/integrations/src/spend.ts`  |
| Stale knowledge and ungrounded output   | Track source freshness, context packs, evidence snapshots, and Trust Receipts; do not default to RAG.                                           | Backlog I/P; `docs/template/knowledge-model.md`    |
| Broken deploy/env cutover               | Keep env manifest, deploy doctor, secret-name checks, staged promotion, and hosted smoke checks.                                                | Backlog S; `project.config.json`                   |

## Client-Fork Rule

A client app reaches production only after
`docs/template/client-handoff-packet.md` records which mitigations are real,
fake/test, live-ready, or still planned for that fork.
